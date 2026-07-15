/**
 * Guest battle routes — unauthenticated visitors can play ONE vs-AI battle
 * without creating an account.
 *
 * Rate limiting: Postgres-backed (survives restarts, not in-memory).
 *   • GUEST_MAX_STARTS_PER_IP_PER_DAY = 3  (per-IP, 24h rolling window)
 *
 * Budget: global guest sub-bucket in Postgres `guest_budget` table.
 *   • GUEST_BUDGET_CENTS_PER_MONTH = 3 000¢ = €30 / month
 *   • Blocks new turns/starts independently of the IP rate limit once exhausted.
 *
 * Session security:
 *   • Guest identity = HttpOnly cookie `sgi_guest_session = "guest_<uuid>"`
 *   • /battles/guest/claim validates cookie matches body.guestId BEFORE
 *     reassigning battle_entries, so a user cannot claim another guest's battle
 *     by passing an arbitrary guestId in the request body.
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  battleMatches,
  battleEntries,
  type SessionMessage,
  type PvpComparison,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { evaluatePvpBattle } from "../lib/pvpBattleScoring";
import { AI_PLAYER_ID, AI_USERNAME, generateAiArgument } from "../lib/aiOpponent";
import { generateBattleTheme } from "./battles.js";
import { randomUUID } from "crypto";
import { users } from "@workspace/db";
import { recordGuestBattleUsage, getGuestFirstBattleAt, clearGuestUsage } from "../lib/userBattleUsage.js";
import {
  COST_BATTLE_ARGUMENT_CENTS as COST_AI_ARGUMENT_CENTS,
  COST_BATTLE_SPARRING_CENTS as COST_SPARRING_TURN_CENTS,
  COST_BATTLE_SCORING_CENTS as COST_SCORING_CENTS,
} from "../config/pricing.js";

const router = Router();

// ─── Tunables ─────────────────────────────────────────────────────────────────
const GUEST_COOKIE                    = "sgi_guest_session";
const GUEST_MAX_STARTS_PER_IP_PER_DAY = 3;
const GUEST_BUDGET_CENTS_PER_MONTH    = 3_000;  // €30 / month — hard backstop
const GUEST_MAX_TURNS                 = 4;       // fewer than auth (12) to limit cost
const TURN_WINDOW_S                   = 390;     // same server-enforced window
const ACTIVE_TTL_MS                   = 24 * 60 * 60 * 1000;
const MIN_CHARS                       = 30;

// Cost estimates (¢) — imported from config/pricing.ts, the single shared
// source of truth also used by the auth-user flow (battleBudget.ts), since
// guest and auth invoke the exact same underlying LLM calls (generateAiArgument,
// evaluatePvpBattle, near-identical sparring prompt). Local aliases kept so the
// rest of this file (and its cost-tracking semantics below) doesn't change.
// Like theme-generation, these are platform costs NOT charged to aiCostCents —
// guest users don't have a DB user record or a per-user budget.

// ─── Guest theme pool (curated subset of the main pool) ───────────────────────
const GUEST_THEME_POOL: Array<{ theme: string; category: string }> = [
  { theme: "La coscienza è un fenomeno emergente o una proprietà fondamentale della realtà?", category: "philosophy" },
  { theme: "Un'intelligenza artificiale può davvero comprendere, o solo simulare la comprensione?", category: "technology" },
  { theme: "La disuguaglianza economica è un difetto da correggere o un motore necessario del progresso?", category: "economics" },
  { theme: "La matematica è scoperta o inventata dall'essere umano?", category: "science" },
  { theme: "La democrazia è il miglior sistema possibile o un compromesso destinato a erodersi?", category: "politics" },
  { theme: "L'arte ha valore intrinseco o solo il valore che la società le attribuisce?", category: "art" },
  { theme: "Il linguaggio plasma il pensiero o si limita a esprimerlo?", category: "philosophy" },
  { theme: "La bellezza è una categoria universale o interamente costruita dalla cultura?", category: "art" },
  { theme: "Il caso o la necessità governa l'andamento della storia umana?", category: "history" },
];

function pickGuestTheme(): { theme: string; category: string } {
  return GUEST_THEME_POOL[Math.floor(Math.random() * GUEST_THEME_POOL.length)]!;
}

const SPARRING_SYSTEM = (theme: string) =>
  `You are a sharp Socratic sparring partner in a focused, timed intellectual debate. The participant is developing and defending their position on a shared THEME. Your role is to PRESSURE-TEST their thinking, turn after turn: probe hidden assumptions, raise the strongest counterexamples and tensions, demand conceptual precision, and push them one level deeper each time.

Rules:
- Be concise and dense: 2–4 sentences, no filler, no flattery, no summaries of what they said.
- Challenge; never argue their case for them and never hand them a ready-made answer.
- Stay on the THEME. Engage seriously and at a high intellectual level.
- NEVER mention scoring, evaluation, points, winning, judging, or that this is a competition.
- Respond in the SAME LANGUAGE as the participant (default Italian).

THEME: ${theme}`;

function concatUserText(messages: SessionMessage[]): string {
  return messages.filter(m => m.role === "user").map(m => m.content).join("\n\n").trim();
}

function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return first?.trim() ?? req.ip ?? "unknown";
}

// ─── Postgres-backed rate limiting + budget ────────────────────────────────────
// Tables are created idempotently at module load — NOT managed by Drizzle migrations.
void (async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS guest_rate_limits (
        ip       TEXT NOT NULL,
        win_date TEXT NOT NULL,
        count    INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (ip, win_date)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS guest_budget (
        month      TEXT PRIMARY KEY,
        used_cents REAL NOT NULL DEFAULT 0
      )
    `);
    console.info("[guest] rate-limit tables ready");
  } catch (err) {
    console.error("[guest] table init error:", err);
  }
})();

async function checkRateLimit(ip: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const row = await db.execute(sql`
    SELECT count FROM guest_rate_limits WHERE ip = ${ip} AND win_date = ${today}
  `);
  const count = (row.rows?.[0] as { count?: number } | undefined)?.count ?? 0;
  return count < GUEST_MAX_STARTS_PER_IP_PER_DAY;
}

async function incrementRateLimit(ip: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await db.execute(sql`
    INSERT INTO guest_rate_limits (ip, win_date, count) VALUES (${ip}, ${today}, 1)
    ON CONFLICT (ip, win_date) DO UPDATE SET count = guest_rate_limits.count + 1
  `);
}

async function checkGuestBudget(): Promise<boolean> {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  const row = await db.execute(sql`
    SELECT used_cents FROM guest_budget WHERE month = ${month}
  `);
  const used = (row.rows?.[0] as { used_cents?: number } | undefined)?.used_cents ?? 0;
  return used < GUEST_BUDGET_CENTS_PER_MONTH;
}

async function chargeGuestBudget(cents: number): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  await db.execute(sql`
    INSERT INTO guest_budget (month, used_cents) VALUES (${month}, ${cents})
    ON CONFLICT (month) DO UPDATE SET used_cents = guest_budget.used_cents + ${cents}
  `);
}

// ─── POST /battles/guest/start ────────────────────────────────────────────────
// Creates a new vs-AI battle for the guest, or resumes an existing open one
// (idempotent: if the HttpOnly cookie identifies an open battle, returns it).
router.post("/battles/guest/start", async (req, res) => {
  try {
    // ── Language must be read first (used both for new battles and resume check) ─
    const lang = typeof req.body?.lang === "string" ? req.body.lang.slice(0, 10) : "it";

    // ── Idempotency: resume existing guest session if cookie is present ────────
    // Only resumes if the battle was already started (turns > 0) to avoid serving
    // a stale Italian theme to a user who has since switched to another language.
    const existingGuestId = (req.cookies as Record<string, string> | undefined)?.[GUEST_COOKIE];
    if (existingGuestId?.startsWith("guest_")) {
      const openRow = await db.execute(sql`
        SELECT e.match_id, e.id as entry_id, e.status as entry_status, e.slot,
               e.started_at, e.messages,
               m.theme, m.category, m.status as match_status
        FROM battle_entries e
        JOIN battle_matches m ON m.id = e.match_id
        WHERE e.user_id = ${existingGuestId}
          AND e.status IN ('matched', 'in_progress')
        LIMIT 1
      `);
      if (openRow.rows?.length) {
        const r = openRow.rows[0] as {
          match_id: string; entry_id: string; entry_status: string; slot: number;
          started_at: string | null; messages: SessionMessage[]; theme: string;
          category: string; match_status: string;
        };
        const msgs = (r.messages ?? []) as SessionMessage[];
        const userTurns = msgs.filter(m => m.role === "user").length;
        // If the user has already submitted at least one turn, always resume.
        // If they haven't typed yet (turnsLeft === GUEST_MAX_TURNS) and language changed,
        // skip resume so a fresh theme in the new language is generated below.
        const neverStarted = userTurns === 0;
        if (!neverStarted || lang === "it") {
          res.json({
            matchId: r.match_id, theme: r.theme, category: r.category,
            matchStatus: r.match_status, entryStatus: r.entry_status, slot: r.slot,
            messages: msgs, turnsLeft: Math.max(0, GUEST_MAX_TURNS - userTurns),
            startedAt: r.started_at, guestId: existingGuestId, resumed: true,
          });
          return;
        }
        // Fall through: generate a new battle in the requested language.
        // The old untouched match will be left as-is (no turns written to it).
      }
    }

    // ── Rate limit (IP-based, Postgres-backed) ────────────────────────────────
    const ip = getClientIp(req as Parameters<typeof getClientIp>[0]);
    if (!(await checkRateLimit(ip))) {
      res.status(429).json({ error: "Daily guest limit reached", code: "RATE_LIMIT" });
      return;
    }

    // ── Guest budget (global monthly sub-bucket €30) ───────────────────────────
    if (!(await checkGuestBudget())) {
      res.status(503).json({ error: "Guest capacity temporarily exhausted", code: "BUDGET_EXHAUSTED" });
      return;
    }

    // ── Build theme + AI argument BEFORE writing to DB ────────────────────────
    // LLM generates theme in the user's language; 2s timeout inside generateBattleTheme
    // rejects and the catch falls back to pickGuestTheme() (Italian static pool).
    let picked: { theme: string; category: string };
    try {
      picked = await generateBattleTheme(null, lang);
    } catch {
      picked = pickGuestTheme();
    }
    const aiText  = await generateAiArgument(picked.theme, "pensatore");
    await chargeGuestBudget(COST_AI_ARGUMENT_CENTS);

    // Record the new IP start
    await incrementRateLimit(ip);

    // ── Create match + both entries ────────────────────────────────────────────
    const guestId   = `guest_${randomUUID()}`;
    // Informational only — guest_usage does NOT gate frequency (that remains the
    // job of guest_rate_limits/guest_budget above). It exists solely so /claim
    // can transfer the "already used a first battle" state to a newly-registered
    // user, preventing a second free first-battle carve-out after signup.
    void recordGuestBattleUsage(guestId);
    const now       = new Date();
    const expiresAt = new Date(Date.now() + ACTIVE_TTL_MS);

    const [created] = await db.insert(battleMatches).values({
      theme: picked.theme, category: picked.category,
      status: "active", vsAi: true, aiLevel: "pensatore", expiresAt,
    }).returning({ id: battleMatches.id });

    const matchId = created!.id;

    await db.insert(battleEntries).values({
      matchId, userId: guestId, username: "Ospite", slot: 1, status: "matched",
    });
    await db.insert(battleEntries).values({
      matchId, userId: AI_PLAYER_ID, username: AI_USERNAME, slot: 2,
      status: "completed", userText: aiText, messages: [],
      startedAt: now, completedAt: now,
    });

    // ── Set HttpOnly session cookie ────────────────────────────────────────────
    const isProd = process.env.NODE_ENV === "production";
    res.cookie(GUEST_COOKIE, guestId, {
      httpOnly: true, sameSite: "lax", secure: isProd,
      maxAge: ACTIVE_TTL_MS, path: "/",
    });

    res.json({
      matchId, theme: picked.theme, category: picked.category,
      matchStatus: "active", entryStatus: "matched", slot: 1,
      messages: [], turnsLeft: GUEST_MAX_TURNS, startedAt: null,
      guestId, resumed: false,
    });
  } catch (err) {
    console.error("[guest] start error", err);
    res.status(500).json({ error: "Failed to start guest battle" });
  }
});

// ─── POST /battles/guest/:matchId/turn ───────────────────────────────────────
router.post("/battles/guest/:matchId/turn", async (req, res) => {
  try {
    const guestId = (req.cookies as Record<string, string> | undefined)?.[GUEST_COOKIE];
    if (!guestId?.startsWith("guest_")) {
      res.status(401).json({ error: "No guest session", code: "NO_SESSION" }); return;
    }

    const matchId = req.params.matchId!;
    const content: string = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (content.length < MIN_CHARS) {
      res.status(400).json({ error: `Minimum ${MIN_CHARS} characters required` }); return;
    }

    const [match] = await db.select().from(battleMatches).where(eq(battleMatches.id, matchId)).limit(1);
    if (!match || match.status !== "active") {
      res.status(404).json({ error: "Match not found or not active" }); return;
    }

    const [mine] = await db.select().from(battleEntries)
      .where(and(eq(battleEntries.matchId, matchId), eq(battleEntries.userId, guestId))).limit(1);
    if (!mine)                         { res.status(403).json({ error: "Not your battle" }); return; }
    if (mine.status === "completed")   { res.status(409).json({ error: "Already completed" }); return; }

    const history    = (mine.messages ?? []) as SessionMessage[];
    const userTurns  = history.filter(m => m.role === "user").length;
    if (userTurns >= GUEST_MAX_TURNS) {
      res.status(409).json({ error: "Max turns reached", code: "MAX_TURNS" }); return;
    }

    // Same IP rate-limit check enforced on /start — a guest could otherwise
    // burn through unlimited sparring-turn LLM calls on a single match without
    // ever hitting the per-IP daily start limit.
    const ip = getClientIp(req as Parameters<typeof getClientIp>[0]);
    if (!(await checkRateLimit(ip))) {
      res.status(429).json({ error: "Daily guest limit reached", code: "RATE_LIMIT" }); return;
    }

    if (!(await checkGuestBudget())) {
      res.status(503).json({ error: "Budget exhausted", code: "BUDGET_EXHAUSTED" }); return;
    }

    // Anchor timer on first turn
    if (!mine.startedAt) {
      await db.update(battleEntries)
        .set({ startedAt: new Date(), status: "in_progress" })
        .where(eq(battleEntries.id, mine.id));
      mine.startedAt = new Date();
    }

    // Enforce server-side timer
    const elapsedMs = Date.now() - mine.startedAt.getTime();
    if (elapsedMs > TURN_WINDOW_S * 1000) {
      const userText = concatUserText(history);
      await db.update(battleEntries)
        .set({ status: "completed", completedAt: new Date(), userText })
        .where(eq(battleEntries.id, mine.id));
      res.status(409).json({ error: "Time is up", code: "TIME_UP" }); return;
    }

    const nowIso  = new Date().toISOString();
    const userMsg: SessionMessage = { role: "user", content, timestamp: nowIso };

    const modelMessages = [
      { role: "system" as const, content: SPARRING_SYSTEM(match.theme) },
      ...history.slice(-8).map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content },
    ];

    let reply = "";
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", max_tokens: 180, temperature: 0.7,
        messages: modelMessages,
      });
      reply = completion.choices[0]?.message?.content?.trim() ?? "";
      await chargeGuestBudget(COST_SPARRING_TURN_CENTS);
    } catch (err) {
      console.error("[guest] sparring error", err);
    }
    if (!reply) reply = "Interessante. Ma su quale assunto si regge davvero la tua posizione? Mettilo alla prova con il controesempio più forte che riesci a immaginare.";

    const aiMsg: SessionMessage = { role: "assistant", content: reply, timestamp: new Date().toISOString() };
    const newMessages = [...history, userMsg, aiMsg];
    const userText    = concatUserText(newMessages);

    await db.update(battleEntries)
      .set({ messages: newMessages, userText, lastTurnAt: new Date(), status: "in_progress" })
      .where(eq(battleEntries.id, mine.id));

    const remaining = Math.max(0, TURN_WINDOW_S - Math.floor(elapsedMs / 1000));
    const turnsLeft  = GUEST_MAX_TURNS - (userTurns + 1);

    res.json({ reply, messages: newMessages, timeRemaining: remaining, turnsLeft });
  } catch (err) {
    console.error("[guest] turn error", err);
    res.status(500).json({ error: "Turn failed" });
  }
});

// ─── POST /battles/guest/:matchId/complete ────────────────────────────────────
router.post("/battles/guest/:matchId/complete", async (req, res) => {
  try {
    const guestId = (req.cookies as Record<string, string> | undefined)?.[GUEST_COOKIE];
    if (!guestId?.startsWith("guest_")) {
      res.status(401).json({ error: "No guest session" }); return;
    }

    const matchId = req.params.matchId!;
    const [match] = await db.select().from(battleMatches).where(eq(battleMatches.id, matchId)).limit(1);
    if (!match) { res.status(404).json({ error: "Match not found" }); return; }

    const entries = await db.select().from(battleEntries).where(eq(battleEntries.matchId, matchId));
    const mine    = entries.find(e => e.userId === guestId);
    const aiEntry = entries.find(e => e.userId === AI_PLAYER_ID);
    if (!mine)    { res.status(403).json({ error: "Not your battle" }); return; }
    if (!aiEntry) { res.status(500).json({ error: "AI entry missing" }); return; }

    // Idempotent: return existing result if already scored
    if (match.status === "completed" && match.comparison) {
      const iAmSlot1 = mine.slot === 1;
      return res.json({
        outcome:    match.tie ? "tie" : match.winnerUserId === guestId ? "win" : "loss",
        myRawScore: iAmSlot1 ? match.comparison.slot1RawScore : match.comparison.slot2RawScore,
        aiRawScore: iAmSlot1 ? match.comparison.slot2RawScore : match.comparison.slot1RawScore,
        reasoning:  match.comparison.reasoning,
        opponentMessages: (aiEntry.messages ?? []) as SessionMessage[],
        guestId,
      });
    }

    // Require at least some content
    const messages = (mine.messages ?? []) as SessionMessage[];
    const userText  = concatUserText(messages);
    if (userText.length < MIN_CHARS) {
      res.status(400).json({ error: "Write something before completing", code: "NO_CONTENT" }); return;
    }

    // Finalize guest entry
    await db.update(battleEntries)
      .set({ status: "completed", completedAt: new Date(), userText })
      .where(eq(battleEntries.id, mine.id));

    await db.update(battleMatches)
      .set({ status: "scoring", updatedAt: new Date() })
      .where(eq(battleMatches.id, matchId));

    // Score: guest (slot 1) vs AI (slot 2)
    const aiText = aiEntry.userText ?? "";
    let comparison: PvpComparison;
    const lengthFallback = (): PvpComparison => {
      const myLen = userText.length, aiLen = aiText.length;
      return {
        winner:        myLen > aiLen ? "slot1" : myLen < aiLen ? "slot2" : "tie",
        reasoning:     "Valutazione automatica basata sulla densità argomentativa.",
        slot1RawScore: Math.min(100, Math.round(myLen / 4)),
        slot2RawScore: Math.min(100, Math.round(aiLen / 4)),
      };
    };
    // Check the budget BEFORE spending on the scoring call — previously this was
    // only charged after a successful call, so an already-exhausted budget was
    // never actually enforced here. A guest's battle must still resolve (never
    // left half-finished), so on exhaustion we go straight to the same
    // length-based fallback used on LLM failure, instead of blocking.
    if (!(await checkGuestBudget())) {
      console.warn("[guest] budget exhausted before scoring — using length fallback");
      comparison = lengthFallback();
    } else {
      try {
        const evaln = await evaluatePvpBattle(match.theme, userText, aiText);
        const reasoning = evaln.outcome.winner === "tie"
          ? "Le due conversazioni sono risultate equivalenti per densità e forza argomentativa."
          : `La conversazione vincente è risultata più densa e convincente (scarto di ${Math.abs(evaln.outcome.margin).toFixed(1)} punti).`;
        comparison = {
          winner:        evaln.outcome.winner,
          reasoning,
          slot1RawScore: evaln.outcome.slot1RawScore,
          slot2RawScore: evaln.outcome.slot2RawScore,
        };
        await chargeGuestBudget(COST_SCORING_CENTS);
      } catch (err) {
        console.error("[guest] scoring error — using length fallback", err);
        comparison = lengthFallback();
      }
    }

    const tie       = comparison.winner === "tie";
    const winnerId  = tie ? null : comparison.winner === "slot1" ? guestId : AI_PLAYER_ID;

    await db.update(battleMatches).set({
      status: "completed", comparison, winnerUserId: winnerId, tie,
      resolvedAt: new Date(), updatedAt: new Date(),
    }).where(eq(battleMatches.id, matchId));

    await db.update(battleEntries).set({ rawScore: Math.round(comparison.slot1RawScore) })
      .where(and(eq(battleEntries.matchId, matchId), eq(battleEntries.userId, guestId)));
    await db.update(battleEntries).set({ rawScore: Math.round(comparison.slot2RawScore) })
      .where(and(eq(battleEntries.matchId, matchId), eq(battleEntries.userId, AI_PLAYER_ID)));

    return res.json({
      outcome:    tie ? "tie" : winnerId === guestId ? "win" : "loss",
      myRawScore: comparison.slot1RawScore,
      aiRawScore: comparison.slot2RawScore,
      reasoning:  comparison.reasoning,
      opponentMessages: (aiEntry.messages ?? []) as SessionMessage[],
      guestId,
    });
  } catch (err) {
    console.error("[guest] complete error", err);
    return res.status(500).json({ error: "Failed to complete battle" });
  }
});

// ─── POST /battles/guest/claim ────────────────────────────────────────────────
// Reassigns all battle_entries from guestId → clerkId after the user signs up.
//
// Security: the guestId is read from the HttpOnly cookie (which the user's browser
// sets automatically, not via JS). The body.guestId is an optional second check.
// A malicious user cannot claim another guest's battle because:
//   (a) they don't have the other guest's HttpOnly cookie, and
//   (b) even if they guess a guestId in the body, it won't match their own cookie.
router.post("/battles/guest/claim", async (req, res) => {
  try {
    const clerkId = getAuth(req).userId;
    if (!clerkId) { res.status(401).json({ error: "Authentication required" }); return; }

    // Primary validation: read guestId from the HttpOnly cookie (cannot be forged by JS)
    const cookieGuestId = (req.cookies as Record<string, string> | undefined)?.[GUEST_COOKIE];
    if (!cookieGuestId?.startsWith("guest_")) {
      res.status(400).json({ error: "No guest session cookie found" }); return;
    }

    // Secondary check: if frontend also sends guestId in body, it must match cookie
    const bodyGuestId = typeof req.body?.guestId === "string" ? req.body.guestId.trim() : null;
    if (bodyGuestId && bodyGuestId !== cookieGuestId) {
      res.status(403).json({ error: "Guest ID mismatch — claim denied" }); return;
    }

    // Prevent unique-index violation: user must not already have an open battle
    const existing = await db.execute(sql`
      SELECT 1 FROM battle_entries
      WHERE user_id = ${clerkId} AND status IN ('matched', 'in_progress')
      LIMIT 1
    `);
    if (existing.rows?.length) {
      res.status(409).json({ error: "You already have an open battle", code: "ALREADY_HAS_BATTLE" });
      return;
    }

    // Reassign entries + correct winner reference atomically
    await db.execute(sql`
      UPDATE battle_entries SET user_id = ${clerkId} WHERE user_id = ${cookieGuestId}
    `);
    await db.execute(sql`
      UPDATE battle_matches SET winner_user_id = ${clerkId}
      WHERE winner_user_id = ${cookieGuestId}
    `);

    // ── First-battle carve-out transfer ────────────────────────────────────────
    // If this guest already played a battle, stamp firstBattleUsedAt on the newly
    // registered user so they don't get a SECOND free first-battle carve-out.
    // Deliberately NOT summed into monthlyBattlesUsed — only the double carve-out
    // is prevented, per plan (guest battles were never counted against a quota).
    const guestFirstBattleAt = await getGuestFirstBattleAt(cookieGuestId);
    if (guestFirstBattleAt) {
      await db.update(users)
        .set({ firstBattleUsedAt: guestFirstBattleAt })
        .where(and(eq(users.clerkId, clerkId), sql`${users.firstBattleUsedAt} IS NULL`));
    }
    await clearGuestUsage(cookieGuestId);

    // Clear the guest cookie
    res.clearCookie(GUEST_COOKIE, { path: "/" });
    res.json({ claimed: true, guestId: cookieGuestId, clerkId });
  } catch (err) {
    console.error("[guest] claim error", err);
    res.status(500).json({ error: "Claim failed" });
  }
});

export default router;
