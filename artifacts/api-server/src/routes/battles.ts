import { getAuth } from "@clerk/express";
import { Router } from "express";
import { db } from "@workspace/db";
import {
  battleMatches,
  battleEntries,
  gamification,
  badges,
  type SessionMessage,
  type BattleEntry,
  type BattleMatch,
  type BattleAnswerScore,
  type PvpComparison,
} from "@workspace/db";
import { eq, and, desc, lt, inArray, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getOrCreateUser } from "../lib/getOrCreateUser";
import {
  evaluatePvpBattle,
  type PvpAnswerScore,
} from "../lib/pvpBattleScoring";
import { updateLeaderboardRank } from "./users";
import {
  AI_PLAYER_ID,
  AI_USERNAME,
  generateAiArgument,
  type AiLevel,
} from "../lib/aiOpponent";

const router = Router();

// ─── Tunables ────────────────────────────────────────────────────────────────
const TURN_WINDOW_S = 390;                 // 6:30 server-enforced conversation window
const WAITING_TTL_MS = 48 * 60 * 60 * 1000; // a lone "waiting" match expires after 48h
const ACTIVE_TTL_MS = 24 * 60 * 60 * 1000;  // once paired, each player has 24h to finish
const MIN_TEXT = 10;                        // below this, a player's contribution is degenerate
const SPARRING_MODEL = "gpt-4o-mini";
const MAX_HISTORY = 12;                     // messages sent to the sparring model

// ─── Shared themes (server-generated; curated so matchmaking never blocks on an LLM)
const THEME_POOL: Array<{ theme: string; category: string }> = [
  { theme: "La coscienza è un fenomeno emergente o una proprietà fondamentale della realtà?", category: "philosophy" },
  { theme: "Il libero arbitrio è compatibile con un universo deterministico?", category: "philosophy" },
  { theme: "La matematica è scoperta o inventata dall'essere umano?", category: "science" },
  { theme: "Un'intelligenza artificiale può davvero comprendere, o solo simulare la comprensione?", category: "technology" },
  { theme: "La disuguaglianza economica è un difetto da correggere o un motore necessario del progresso?", category: "economics" },
  { theme: "L'arte ha valore intrinseco o solo il valore che la società le attribuisce?", category: "art" },
  { theme: "La memoria collettiva di una società ne determina il destino più dei fatti oggettivi?", category: "history" },
  { theme: "Il linguaggio plasma il pensiero o si limita a esprimerlo?", category: "philosophy" },
  { theme: "Il progresso tecnologico amplia davvero la libertà umana o ne crea nuove forme di dipendenza?", category: "technology" },
  { theme: "La verità scientifica è oggettiva o sempre mediata dal paradigma culturale di chi la cerca?", category: "science" },
  { theme: "La giustizia richiede uguaglianza di risultati o solo uguaglianza di opportunità?", category: "philosophy" },
  { theme: "L'identità personale persiste nel tempo o è un'illusione utile che ricostruiamo di continuo?", category: "philosophy" },
  { theme: "L'evoluzione culturale ha superato l'evoluzione biologica nel definire l'essere umano?", category: "science" },
  { theme: "La democrazia è il miglior sistema possibile o un compromesso destinato a erodersi?", category: "politics" },
  { theme: "La bellezza è una categoria universale o interamente costruita dalla cultura?", category: "art" },
  { theme: "Il caso o la necessità governa l'andamento della storia umana?", category: "history" },
];

function pickTheme() {
  return THEME_POOL[Math.floor(Math.random() * THEME_POOL.length)]!;
}

// ─── AI sparring partner (Socratic challenger; NOT the opponent being scored) ──
const SPARRING_SYSTEM = (theme: string) => `You are a sharp Socratic sparring partner in a focused, timed intellectual debate. The participant is developing and defending their position on a shared THEME. Your role is to PRESSURE-TEST their thinking, turn after turn: probe hidden assumptions, raise the strongest counterexamples and tensions, demand conceptual precision, and push them one level deeper each time.

Rules:
- Be concise and dense: 2–4 sentences, no filler, no flattery, no summaries of what they said.
- Challenge; never argue their case for them and never hand them a ready-made answer.
- Stay on the THEME. Engage seriously and at a high intellectual level.
- NEVER mention scoring, evaluation, points, winning, judging, or that this is a competition.
- Respond in the SAME LANGUAGE as the participant (default Italian).

THEME: ${theme}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function usernameFor(user: { email: string | null }): string {
  return user.email?.split("@")[0] ?? "anon";
}

function concatUserText(messages: SessionMessage[]): string {
  return messages.filter(m => m.role === "user").map(m => m.content).join("\n\n").trim();
}

function timeRemaining(entry: Pick<BattleEntry, "startedAt" | "status">): number {
  if (!entry.startedAt) return TURN_WINDOW_S;
  if (entry.status === "completed" || entry.status === "forfeit") return 0;
  const elapsed = (Date.now() - new Date(entry.startedAt).getTime()) / 1000;
  return Math.max(0, Math.round(TURN_WINDOW_S - elapsed));
}

function isExpired(entry: Pick<BattleEntry, "startedAt">): boolean {
  if (!entry.startedAt) return false;
  const elapsed = (Date.now() - new Date(entry.startedAt).getTime()) / 1000;
  return elapsed > TURN_WINDOW_S;
}

// Award XP into gamification (feeds levels + streak) for a clerk user. Idempotency
// of the *match* is guaranteed by the resolution claim, so this runs at most once.
async function awardXp(clerkId: string, xp: number): Promise<void> {
  if (xp <= 0) return;
  if (clerkId === AI_PLAYER_ID) return; // AI player has no DB user
  const user = await getOrCreateUser(clerkId);
  if (!user) return;
  const today = new Date().toISOString().split("T")[0]!;
  await db.insert(gamification)
    .values({ userId: user.id, xp, level: Math.floor(Math.sqrt(xp / 100)) + 1, streak: 1, lastActiveDate: today })
    .onConflictDoUpdate({
      target: gamification.userId,
      set: {
        xp: sql`${gamification.xp} + ${xp}`,
        streak: sql`CASE WHEN DATE(${gamification.lastActiveDate}) = CURRENT_DATE - INTERVAL '1 day' THEN ${gamification.streak} + 1 WHEN DATE(${gamification.lastActiveDate}) = CURRENT_DATE THEN ${gamification.streak} ELSE 1 END`,
        lastActiveDate: today,
        level: sql`floor(sqrt((${gamification.xp} + ${xp}) / 100.0)) + 1`,
      },
    });
  await updateLeaderboardRank(user.id);
}

// Grant the one-time PvP victory badge (reuses the battle_victor badge key, now
// earned by beating a HUMAN opponent). badges has no (user,key) unique index, so
// we guard with a read before insert.
async function awardVictorBadge(clerkId: string): Promise<void> {
  if (clerkId === AI_PLAYER_ID) return; // AI player has no DB user
  const user = await getOrCreateUser(clerkId);
  if (!user) return;
  const existing = await db.select({ id: badges.id }).from(badges)
    .where(and(eq(badges.userId, user.id), eq(badges.badgeKey, "battle_victor"))).limit(1);
  if (existing.length === 0) {
    await db.insert(badges).values({ userId: user.id, badgeKey: "battle_victor" });
  }
}

// Persist the final outcome (entries + match) atomically, then award XP/badges.
async function finalizeMatch(
  match: BattleMatch,
  e1: BattleEntry,
  e2: BattleEntry,
  res: {
    score1: PvpAnswerScore | null; score2: PvpAnswerScore | null;
    raw1: number; raw2: number; xp1: number; xp2: number;
    winner: "slot1" | "slot2" | "tie"; reasoning: string;
  },
): Promise<void> {
  const winnerUserId = res.winner === "slot1" ? e1.userId : res.winner === "slot2" ? e2.userId : null;
  const comparison: PvpComparison = {
    winner: res.winner,
    reasoning: res.reasoning,
    slot1RawScore: Math.round(res.raw1),
    slot2RawScore: Math.round(res.raw2),
  };
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(battleEntries)
      .set({ score: (res.score1 as unknown as BattleAnswerScore) ?? null, rawScore: Math.round(res.raw1), xpAwarded: res.xp1 })
      .where(eq(battleEntries.id, e1.id));
    await tx.update(battleEntries)
      .set({ score: (res.score2 as unknown as BattleAnswerScore) ?? null, rawScore: Math.round(res.raw2), xpAwarded: res.xp2 })
      .where(eq(battleEntries.id, e2.id));
    await tx.update(battleMatches)
      .set({ status: "completed", winnerUserId, tie: res.winner === "tie", comparison, resolvedAt: now, updatedAt: now })
      .where(eq(battleMatches.id, match.id));
  });

  // XP/badges after commit. The 'scoring' claim guarantees single execution.
  await awardXp(e1.userId, res.xp1).catch(e => console.error("[battles] awardXp slot1", e));
  await awardXp(e2.userId, res.xp2).catch(e => console.error("[battles] awardXp slot2", e));
  if (winnerUserId) await awardVictorBadge(winnerUserId).catch(e => console.error("[battles] badge", e));
}

// Resolve a fully-completed match: dual-score both contributions, decide the
// winner, persist + award. Guarded by an atomic claim so it runs exactly once.
async function resolveMatch(matchId: string): Promise<void> {
  const claim = await db.execute(
    sql`UPDATE battle_matches SET status = 'scoring', updated_at = now() WHERE id = ${matchId} AND status = 'active' RETURNING id`,
  );
  if (!claim.rows?.length) return; // another caller is resolving, or already done

  try {
    const [match] = await db.select().from(battleMatches).where(eq(battleMatches.id, matchId)).limit(1);
    const entries = await db.select().from(battleEntries).where(eq(battleEntries.matchId, matchId));
    const e1 = entries.find(e => e.slot === 1);
    const e2 = entries.find(e => e.slot === 2);
    if (!match || !e1 || !e2) {
      await db.update(battleMatches).set({ status: "active", updatedAt: new Date() }).where(eq(battleMatches.id, matchId));
      return;
    }

    const t1 = (e1.userText ?? "").trim();
    const t2 = (e2.userText ?? "").trim();
    const ok1 = t1.length >= MIN_TEXT;
    const ok2 = t2.length >= MIN_TEXT;

    // Degenerate cases avoid an LLM call entirely.
    if (!ok1 && !ok2) {
      await finalizeMatch(match, e1, e2, {
        score1: null, score2: null, raw1: 0, raw2: 0, xp1: 5, xp2: 5,
        winner: "tie", reasoning: "Nessuno dei due ha argomentato a sufficienza: pareggio.",
      });
      return;
    }
    if (ok1 && !ok2) {
      await finalizeMatch(match, e1, e2, {
        score1: null, score2: null, raw1: 50, raw2: 0, xp1: 50, xp2: 0,
        winner: "slot1", reasoning: "L'avversario non ha argomentato a sufficienza.",
      });
      return;
    }
    if (!ok1 && ok2) {
      await finalizeMatch(match, e1, e2, {
        score1: null, score2: null, raw1: 0, raw2: 50, xp1: 0, xp2: 50,
        winner: "slot2", reasoning: "L'avversario non ha argomentato a sufficienza.",
      });
      return;
    }

    // Both have real content → head-to-head dual scoring.
    const evaln = await evaluatePvpBattle(match.theme, t1, t2);
    const reasoning = evaln.outcome.winner === "tie"
      ? "Le due conversazioni sono risultate equivalenti per densità e forza argomentativa."
      : `La conversazione vincente è risultata più densa e convincente (scarto di ${Math.abs(evaln.outcome.margin).toFixed(1)} punti).`;
    await finalizeMatch(match, e1, e2, {
      score1: evaln.slot1, score2: evaln.slot2,
      raw1: evaln.outcome.slot1RawScore, raw2: evaln.outcome.slot2RawScore,
      xp1: evaln.reward.slot1Xp, xp2: evaln.reward.slot2Xp,
      winner: evaln.outcome.winner, reasoning,
    });
  } catch (err) {
    console.error("[battles] resolveMatch failed, reverting to active", err);
    await db.update(battleMatches).set({ status: "active", updatedAt: new Date() })
      .where(and(eq(battleMatches.id, matchId), eq(battleMatches.status, "scoring")));
  }
}

// One player completed, the other ran out of time → win by forfeit (no LLM).
async function resolveForfeit(match: BattleMatch, winnerEntry: BattleEntry, loserEntry: BattleEntry): Promise<void> {
  const claim = await db.execute(
    sql`UPDATE battle_matches SET status = 'scoring', updated_at = now() WHERE id = ${match.id} AND status = 'active' RETURNING id`,
  );
  if (!claim.rows?.length) return;
  try {
    await db.update(battleEntries).set({ status: "forfeit" }).where(eq(battleEntries.id, loserEntry.id));
    const [m] = await db.select().from(battleMatches).where(eq(battleMatches.id, match.id)).limit(1);
    const e1 = winnerEntry.slot === 1 ? winnerEntry : loserEntry;
    const e2 = winnerEntry.slot === 1 ? loserEntry : winnerEntry;
    const winnerIsSlot1 = winnerEntry.slot === 1;
    await finalizeMatch(m ?? match, e1, e2, {
      score1: null, score2: null,
      raw1: winnerIsSlot1 ? 50 : 0, raw2: winnerIsSlot1 ? 0 : 50,
      xp1: winnerIsSlot1 ? 50 : 0, xp2: winnerIsSlot1 ? 0 : 50,
      winner: winnerIsSlot1 ? "slot1" : "slot2",
      reasoning: "Vittoria per abbandono: l'avversario non ha completato in tempo.",
    });
  } catch (err) {
    console.error("[battles] resolveForfeit failed, reverting", err);
    await db.update(battleMatches).set({ status: "active", updatedAt: new Date() })
      .where(and(eq(battleMatches.id, match.id), eq(battleMatches.status, "scoring")));
  }
}

// Lightweight expiry reconciliation, run on read/matchmake (no background jobs).
async function reconcileExpiredMatches(): Promise<void> {
  const now = new Date();
  try {
    // Lone "waiting" matches that timed out → abandoned, free the lone entry.
    const staleWaiting = await db.select().from(battleMatches)
      .where(and(eq(battleMatches.status, "waiting"), lt(battleMatches.expiresAt, now))).limit(20);
    for (const m of staleWaiting) {
      await db.update(battleEntries).set({ status: "forfeit" })
        .where(and(eq(battleEntries.matchId, m.id), inArray(battleEntries.status, ["matched", "in_progress"])));
      await db.update(battleMatches).set({ status: "abandoned", updatedAt: now })
        .where(and(eq(battleMatches.id, m.id), eq(battleMatches.status, "waiting")));
    }

    // Active matches past their deadline → resolve by forfeit or abandon.
    const staleActive = await db.select().from(battleMatches)
      .where(and(eq(battleMatches.status, "active"), lt(battleMatches.expiresAt, now))).limit(20);
    for (const m of staleActive) {
      const entries = await db.select().from(battleEntries).where(eq(battleEntries.matchId, m.id));
      const e1 = entries.find(e => e.slot === 1);
      const e2 = entries.find(e => e.slot === 2);
      if (!e1 || !e2) continue;
      const c1 = e1.status === "completed";
      const c2 = e2.status === "completed";
      if (c1 && c2) { await resolveMatch(m.id); }
      else if (c1) { await resolveForfeit(m, e1, e2); }
      else if (c2) { await resolveForfeit(m, e2, e1); }
      else {
        await db.update(battleEntries).set({ status: "forfeit" })
          .where(and(eq(battleEntries.matchId, m.id), inArray(battleEntries.status, ["matched", "in_progress"])));
        await db.update(battleMatches).set({ status: "abandoned", updatedAt: now })
          .where(and(eq(battleMatches.id, m.id), eq(battleMatches.status, "active")));
      }
    }

    // Active matches where ONE player finished and the OTHER's 390s window has lapsed
    // without completing → resolve by forfeit now, rather than waiting for the 24h TTL.
    const lapsed = await db.execute(sql`
      SELECT DISTINCT m.id AS id
      FROM battle_matches m
      JOIN battle_entries done ON done.match_id = m.id AND done.status = 'completed'
      JOIN battle_entries late ON late.match_id = m.id
        AND late.status IN ('matched', 'in_progress')
        AND late.started_at IS NOT NULL
        AND late.started_at < now() - make_interval(secs => ${TURN_WINDOW_S})
      WHERE m.status = 'active'
      LIMIT 50
    `);
    for (const row of (lapsed.rows ?? []) as Array<{ id: string }>) {
      const [m] = await db.select().from(battleMatches).where(eq(battleMatches.id, row.id)).limit(1);
      if (!m || m.status !== "active") continue;
      const entries = await db.select().from(battleEntries).where(eq(battleEntries.matchId, row.id));
      const e1 = entries.find(e => e.slot === 1);
      const e2 = entries.find(e => e.slot === 2);
      if (!e1 || !e2) continue;
      const c1 = e1.status === "completed";
      const c2 = e2.status === "completed";
      if (c1 && c2) await resolveMatch(row.id);
      else if (c1 && !c2 && e2.startedAt && isExpired(e2)) await resolveForfeit(m, e1, e2);
      else if (c2 && !c1 && e1.startedAt && isExpired(e1)) await resolveForfeit(m, e2, e1);
    }
  } catch (err) {
    console.error("[battles] reconcileExpiredMatches error", err);
  }
}

// ─── Match view: what a given player is allowed to see ────────────────────────
async function buildMatchView(clerkId: string, matchId: string) {
  const [match] = await db.select().from(battleMatches).where(eq(battleMatches.id, matchId)).limit(1);
  if (!match) return null;
  const entries = await db.select().from(battleEntries).where(eq(battleEntries.matchId, matchId));
  const mine = entries.find(e => e.userId === clerkId);
  if (!mine) return null; // authz: requester must be a participant
  const opponent = entries.find(e => e.userId !== clerkId);

  const completed = match.status === "completed";
  const myMessages = (mine.messages ?? []) as SessionMessage[];

  let result: Record<string, unknown> | null = null;
  if (completed) {
    const iAmSlot1 = mine.slot === 1;
    const myRaw = iAmSlot1 ? (match.comparison?.slot1RawScore ?? 0) : (match.comparison?.slot2RawScore ?? 0);
    const oppRaw = iAmSlot1 ? (match.comparison?.slot2RawScore ?? 0) : (match.comparison?.slot1RawScore ?? 0);
    let myResult: "win" | "loss" | "tie" = "tie";
    if (match.tie) myResult = "tie";
    else if (match.winnerUserId === clerkId) myResult = "win";
    else myResult = "loss";
    result = {
      outcome: myResult,
      myRawScore: myRaw,
      opponentRawScore: oppRaw,
      myScore: mine.score ?? null,
      opponentScore: opponent?.score ?? null,
      reasoning: match.comparison?.reasoning ?? "",
      xpAwarded: mine.xpAwarded ?? 0,
      // Opponent's conversation is revealed only AFTER the match resolves.
      opponentMessages: (opponent?.messages ?? []) as SessionMessage[],
      opponentUsername: opponent?.username ?? "Avversario",
    };
  }

  return {
    matchId: match.id,
    status: match.status,
    theme: match.theme,
    category: match.category,
    createdAt: match.createdAt,
    waitingSince: match.status === "waiting" ? match.createdAt : null,
    vsAi: match.vsAi,
    aiLevel: match.aiLevel ?? null,
    mySlot: mine.slot,
    myEntryStatus: mine.status,
    startedAt: mine.startedAt,
    timeRemaining: timeRemaining(mine),
    turnWindowSeconds: TURN_WINDOW_S,
    myMessages,
    opponentPresent: !!opponent,
    opponentUsername: completed
      ? (opponent?.username ?? "Avversario")
      : (opponent ? (opponent.username ?? "Avversario") : null),
    opponentCompleted: opponent?.status === "completed" || opponent?.status === "forfeit",
    result,
  };
}

// ─── POST /battles/matchmake — automatic, race-safe pairing ──────────────────
router.post("/battles/matchmake", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const user = await getOrCreateUser(clerkId);
    if (!user) { res.status(500).json({ error: "Failed to initialize user" }); return; }
    const username = usernameFor(user);

    await reconcileExpiredMatches();

    const matchId = await db.transaction(async (tx) => {
      // 1. If I already have an OPEN entry, resume that match (idempotent).
      const existing = await tx.execute(sql`
        SELECT match_id FROM battle_entries
        WHERE user_id = ${clerkId} AND status IN ('matched', 'in_progress')
        LIMIT 1
      `);
      const existingMatchId = (existing.rows?.[0] as { match_id?: string } | undefined)?.match_id;
      if (existingMatchId) return existingMatchId;

      // 2. Claim one waiting match that is NOT mine (lock row, skip contended).
      const waiting = await tx.execute(sql`
        SELECT id FROM battle_matches m
        WHERE m.status = 'waiting'
          AND NOT EXISTS (
            SELECT 1 FROM battle_entries e WHERE e.match_id = m.id AND e.user_id = ${clerkId}
          )
        ORDER BY m.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `);
      const waitingId = (waiting.rows?.[0] as { id?: string } | undefined)?.id;
      if (waitingId) {
        await tx.insert(battleEntries).values({
          matchId: waitingId, userId: clerkId, username, slot: 2, status: "matched",
        });
        await tx.update(battleMatches)
          .set({ status: "active", expiresAt: new Date(Date.now() + ACTIVE_TTL_MS), updatedAt: new Date() })
          .where(eq(battleMatches.id, waitingId));
        return waitingId;
      }

      // 3. Nobody waiting → open a new match with a fresh shared theme.
      const picked = pickTheme();
      const [created] = await tx.insert(battleMatches).values({
        theme: picked.theme, category: picked.category, status: "waiting",
        expiresAt: new Date(Date.now() + WAITING_TTL_MS),
      }).returning({ id: battleMatches.id });
      await tx.insert(battleEntries).values({
        matchId: created!.id, userId: clerkId, username, slot: 1, status: "matched",
      });
      return created!.id;
    });

    const view = await buildMatchView(clerkId, matchId);
    res.json(view);
  } catch (err) {
    console.error("[battles] matchmake error", err);
    res.status(500).json({ error: "Matchmaking failed" });
  }
});

// ─── GET /battles/matches/me — my active/recent matches ──────────────────────
router.get("/battles/matches/me", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    await reconcileExpiredMatches();

    const myEntries = await db.select().from(battleEntries)
      .where(eq(battleEntries.userId, clerkId))
      .orderBy(desc(battleEntries.createdAt))
      .limit(20);
    if (myEntries.length === 0) { res.json([]); return; }

    const matchIds = myEntries.map(e => e.matchId);
    const matches = await db.select().from(battleMatches).where(inArray(battleMatches.id, matchIds));
    const matchMap = new Map(matches.map(m => [m.id, m]));

    const list = myEntries.map(e => {
      const m = matchMap.get(e.matchId);
      if (!m) return null;
      const iAmSlot1 = e.slot === 1;
      const myResult = m.status === "completed"
        ? (m.tie ? "tie" : m.winnerUserId === clerkId ? "win" : "loss")
        : null;
      return {
        matchId: m.id,
        status: m.status,
        theme: m.theme,
        category: m.category,
        createdAt: m.createdAt,
        myEntryStatus: e.status,
        timeRemaining: timeRemaining(e),
        result: myResult,
        myRawScore: m.status === "completed" ? (iAmSlot1 ? m.comparison?.slot1RawScore ?? 0 : m.comparison?.slot2RawScore ?? 0) : null,
        vsAi: m.vsAi,
        aiLevel: m.aiLevel ?? null,
      };
    }).filter(Boolean);

    res.json(list);
  } catch (err) {
    console.error("[battles] matches/me error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── GET /battles/matches/:id — full detail for a participant ────────────────
router.get("/battles/matches/:id", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const matchId = req.params.id!;

    // Authz FIRST: the requester must be a participant before any resolution side
    // effect (otherwise a non-participant could trigger scoring/XP on a guessed id).
    const entries = await db.select().from(battleEntries).where(eq(battleEntries.matchId, matchId));
    if (!entries.some(e => e.userId === clerkId)) { res.status(404).json({ error: "Match not found" }); return; }

    // Resolve on read: both done → score; one done + opponent's 390s window lapsed → forfeit.
    const [m] = await db.select().from(battleMatches).where(eq(battleMatches.id, matchId)).limit(1);
    if (m && m.status === "active") {
      const e1 = entries.find(e => e.slot === 1);
      const e2 = entries.find(e => e.slot === 2);
      if (e1 && e2) {
        const c1 = e1.status === "completed";
        const c2 = e2.status === "completed";
        if (c1 && c2) await resolveMatch(matchId);
        else if (c1 && !c2 && e2.startedAt && isExpired(e2)) await resolveForfeit(m, e1, e2);
        else if (c2 && !c1 && e1.startedAt && isExpired(e1)) await resolveForfeit(m, e2, e1);
      }
    }

    const view = await buildMatchView(clerkId, matchId);
    if (!view) { res.status(404).json({ error: "Match not found" }); return; }
    res.json(view);
  } catch (err) {
    console.error("[battles] match detail error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── POST /battles/matches/:id/start — anchor the server timer ───────────────
router.post("/battles/matches/:id/start", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const matchId = req.params.id!;

    const [match] = await db.select().from(battleMatches).where(eq(battleMatches.id, matchId)).limit(1);
    if (!match) { res.status(404).json({ error: "Match not found" }); return; }
    const [mine] = await db.select().from(battleEntries)
      .where(and(eq(battleEntries.matchId, matchId), eq(battleEntries.userId, clerkId))).limit(1);
    if (!mine) { res.status(403).json({ error: "Not a participant" }); return; }
    if (match.status !== "active") { res.status(409).json({ error: "Match not ready", code: "WAITING_OPPONENT" }); return; }
    if (mine.status === "completed" || mine.status === "forfeit") {
      const view = await buildMatchView(clerkId, matchId);
      res.json(view); return;
    }

    if (!mine.startedAt) {
      await db.update(battleEntries)
        .set({ startedAt: new Date(), status: "in_progress", lastTurnAt: new Date() })
        .where(eq(battleEntries.id, mine.id));
    }
    const view = await buildMatchView(clerkId, matchId);
    res.json(view);
  } catch (err) {
    console.error("[battles] start error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── POST /battles/matches/:id/turn — one user message + AI sparring reply ───
router.post("/battles/matches/:id/turn", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const matchId = req.params.id!;
    const content: string = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!content) { res.status(400).json({ error: "Message content is required" }); return; }

    const [match] = await db.select().from(battleMatches).where(eq(battleMatches.id, matchId)).limit(1);
    if (!match) { res.status(404).json({ error: "Match not found" }); return; }
    const [mine] = await db.select().from(battleEntries)
      .where(and(eq(battleEntries.matchId, matchId), eq(battleEntries.userId, clerkId))).limit(1);
    if (!mine) { res.status(403).json({ error: "Not a participant" }); return; }
    if (match.status !== "active") { res.status(409).json({ error: "Match not active", code: "WAITING_OPPONENT" }); return; }
    if (mine.status === "completed" || mine.status === "forfeit") {
      res.status(409).json({ error: "Your turn window is closed", code: "ALREADY_DONE" }); return;
    }

    // Server-owned timer: anchor on first turn; reject + auto-complete once past.
    if (!mine.startedAt) {
      await db.update(battleEntries).set({ startedAt: new Date(), status: "in_progress" }).where(eq(battleEntries.id, mine.id));
      mine.startedAt = new Date();
    } else if (isExpired(mine)) {
      await completeEntryAndMaybeResolve(clerkId, matchId);
      res.status(409).json({ error: "Time is up", code: "TIME_UP" });
      return;
    }

    const history = ((mine.messages ?? []) as SessionMessage[]);
    const nowIso = new Date().toISOString();
    const userMsg: SessionMessage = { role: "user", content, timestamp: nowIso };

    // Build the sparring context (cap history) and get a concise challenge.
    const modelMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: SPARRING_SYSTEM(match.theme) },
      ...history.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content })),
      { role: "user", content },
    ];

    let reply = "";
    try {
      const completion = await openai.chat.completions.create({
        model: SPARRING_MODEL,
        max_tokens: 400,
        temperature: 0.7,
        messages: modelMessages,
      });
      reply = completion.choices[0]?.message?.content?.trim() ?? "";
    } catch (err) {
      console.error("[battles] sparring model error", err);
    }
    if (!reply) reply = "Interessante. Ma su quale assunto si regge davvero la tua posizione? Mettilo alla prova con il controesempio più forte che riesci a immaginare.";

    const aiMsg: SessionMessage = { role: "assistant", content: reply, timestamp: new Date().toISOString() };
    const newMessages = [...history, userMsg, aiMsg];
    const userText = concatUserText(newMessages);

    await db.update(battleEntries)
      .set({ messages: newMessages, userText, lastTurnAt: new Date(), status: "in_progress" })
      .where(eq(battleEntries.id, mine.id));

    res.json({
      reply,
      messages: newMessages,
      timeRemaining: timeRemaining({ startedAt: mine.startedAt, status: "in_progress" }),
    });
  } catch (err) {
    console.error("[battles] turn error", err);
    res.status(500).json({ error: "Turn failed" });
  }
});

// Mark MY entry completed; then resolve the match if the opponent is also done OR
// the opponent's 390s window has already lapsed (forfeit) — no waiting for the TTL.
async function completeEntryAndMaybeResolve(clerkId: string, matchId: string): Promise<void> {
  const [mine] = await db.select().from(battleEntries)
    .where(and(eq(battleEntries.matchId, matchId), eq(battleEntries.userId, clerkId))).limit(1);
  if (!mine) return;
  if (mine.status !== "completed" && mine.status !== "forfeit") {
    const userText = concatUserText((mine.messages ?? []) as SessionMessage[]);
    await db.update(battleEntries)
      .set({ status: "completed", completedAt: new Date(), userText })
      .where(eq(battleEntries.id, mine.id));
  }
  const entries = await db.select().from(battleEntries).where(eq(battleEntries.matchId, matchId));
  const e1 = entries.find(e => e.slot === 1);
  const e2 = entries.find(e => e.slot === 2);
  if (!e1 || !e2) return;
  const c1 = e1.status === "completed";
  const c2 = e2.status === "completed";
  if (c1 && c2) { await resolveMatch(matchId); return; }
  // I'm done but the opponent's turn window already lapsed → forfeit them immediately.
  const [m] = await db.select().from(battleMatches).where(eq(battleMatches.id, matchId)).limit(1);
  if (!m || m.status !== "active") return;
  if (c1 && !c2 && e2.startedAt && isExpired(e2)) await resolveForfeit(m, e1, e2);
  else if (c2 && !c1 && e1.startedAt && isExpired(e1)) await resolveForfeit(m, e2, e1);
}

// ─── POST /battles/matches/:id/complete — finish my side (async) ─────────────
router.post("/battles/matches/:id/complete", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const matchId = req.params.id!;

    const [match] = await db.select().from(battleMatches).where(eq(battleMatches.id, matchId)).limit(1);
    if (!match) { res.status(404).json({ error: "Match not found" }); return; }
    const [mine] = await db.select().from(battleEntries)
      .where(and(eq(battleEntries.matchId, matchId), eq(battleEntries.userId, clerkId))).limit(1);
    if (!mine) { res.status(403).json({ error: "Not a participant" }); return; }

    // A "waiting" match has no opponent: completing it would orphan a finished entry
    // and free the open-entry guard, letting the user spawn ghost matches. Reject it.
    if (match.status === "waiting") {
      res.status(409).json({ error: "No opponent yet", code: "WAITING_OPPONENT" }); return;
    }
    // Only an active match has work to finish; resolved states are returned idempotently.
    if (match.status === "active") {
      await completeEntryAndMaybeResolve(clerkId, matchId);
    }
    const view = await buildMatchView(clerkId, matchId);
    res.json(view);
  } catch (err) {
    console.error("[battles] complete error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── POST /battles/matches/:id/ai-join — accept AI opponent at chosen level ───
// Atomically claims a "waiting" match and inserts a pre-completed AI entry.
// Returns 409 HUMAN_JOINED if a real human claimed the match in the meantime.
router.post("/battles/matches/:id/ai-join", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const matchId = req.params.id!;

    const rawLevel: unknown = req.body?.level;
    const VALID_LEVELS: AiLevel[] = ["sfidante", "pensatore", "maestro"];
    const level: AiLevel = VALID_LEVELS.includes(rawLevel as AiLevel) ? (rawLevel as AiLevel) : "pensatore";

    // Atomically claim the waiting match and retrieve the server-side theme.
    // We return `theme` here so we never trust client-supplied theme for AI generation.
    const claim = await db.execute(sql`
      UPDATE battle_matches
      SET status = 'active',
          vs_ai  = true,
          ai_level = ${level},
          expires_at = now() + make_interval(secs => ${ACTIVE_TTL_MS / 1000}),
          updated_at = now()
      WHERE id = ${matchId}
        AND status = 'waiting'
        AND EXISTS (
          SELECT 1 FROM battle_entries
          WHERE match_id = ${matchId} AND user_id = ${clerkId}
        )
      RETURNING id, theme
    `);

    if (!claim.rows?.length) {
      // Match was taken by a human or no longer waiting — let frontend handle it.
      res.status(409).json({ error: "Match not available for AI join", code: "HUMAN_JOINED" });
      return;
    }

    // Use server-side theme only — never trust req.body.theme.
    const matchTheme = (claim.rows[0] as { theme: string }).theme;
    const aiText = await generateAiArgument(matchTheme, level);

    await db.insert(battleEntries).values({
      matchId,
      userId: AI_PLAYER_ID,
      username: AI_USERNAME,
      slot: 2,
      status: "completed",
      userText: aiText,
      messages: [],
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const view = await buildMatchView(clerkId, matchId);
    if (!view) { res.status(404).json({ error: "Match not found after AI join" }); return; }
    res.json(view);
  } catch (err) {
    console.error("[battles] ai-join error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── GET /battles/public — feed of resolved PvP matches ──────────────────────
router.get("/battles/public", async (_req, res) => {
  try {
    await reconcileExpiredMatches();
    const matches = await db.select().from(battleMatches)
      .where(and(eq(battleMatches.status, "completed"), eq(battleMatches.tie, false)))
      .orderBy(desc(battleMatches.resolvedAt))
      .limit(30);
    if (matches.length === 0) { res.json([]); return; }

    const ids = matches.map(m => m.id);
    const entries = await db.select().from(battleEntries).where(inArray(battleEntries.matchId, ids));
    const byMatch = new Map<string, BattleEntry[]>();
    for (const e of entries) {
      const arr = byMatch.get(e.matchId) ?? [];
      arr.push(e);
      byMatch.set(e.matchId, arr);
    }

    const feed = matches.map(m => {
      const es = byMatch.get(m.id) ?? [];
      const e1 = es.find(e => e.slot === 1);
      const e2 = es.find(e => e.slot === 2);
      if (!e1 || !e2) return null;
      const r1 = m.comparison?.slot1RawScore ?? e1.rawScore ?? 0;
      const r2 = m.comparison?.slot2RawScore ?? e2.rawScore ?? 0;
      return {
        id: m.id,
        createdAt: m.resolvedAt ?? m.createdAt,
        isVsAi: m.vsAi,
        theme: m.theme,
        category: m.category,
        player1: { username: e1.username ?? "Anonimo", rawScore: r1, isWinner: m.winnerUserId === e1.userId },
        player2: { username: e2.username ?? "Anonimo", rawScore: r2, isWinner: m.winnerUserId === e2.userId },
      };
    }).filter(Boolean);

    res.json(feed);
  } catch (err) {
    console.error("[battles] public feed error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
