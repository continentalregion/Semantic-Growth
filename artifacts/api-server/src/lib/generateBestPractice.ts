import { db } from "@workspace/db";
import { bestPractices, bestPracticeSignals } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateBestPracticeParams {
  userId: number;
  source: "chat" | "battle";
  triggerType: "explicit" | "inferred";
  userTurns: string;          // concatenated user messages (raw, not yet anonymised)
  category?: string;          // hint — Claude will validate/override
  sourceConvoId?: number | null;
  sourceMatchId?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Advisory lock range: userId + 200_000.
// Chosen to not collide with generateVerdict (+100_000) or recommendations (+0).
const LOCK_OFFSET = 200_000;

// "proposed" rows are garbage-collected after 72h if not approved or rejected.
const EXPIRES_HOURS = 72;

// Global per-user cooldown: do not propose more than once every 48h.
const COOLDOWN_HOURS = 48;

// Minimum word count for the generated technique text.
const MIN_WORDS = 25;

// Word-overlap Jaccard threshold above which we consider a duplicate (0 = always allow, 1 = exact match only).
const DUPLICATE_JACCARD_THRESHOLD = 0.55;

// ─── Prompt ───────────────────────────────────────────────────────────────────

const BEST_PRACTICE_PROMPT = (userTurns: string, categoryHint: string) => `
You are curating an anonymous, shared library of reasoning techniques used by thinkers on SGI — an app that measures how people argue and reason.

Your task: extract ONE transferable reasoning technique demonstrated in the turns below, and describe it in a way that is useful to ANY reader, with ZERO connection to the original speaker.

SOURCE TURNS (raw user messages — may contain personal context):
${userTurns.slice(0, 1200)}

CATEGORY HINT (from conversation metadata): ${categoryHint}

════════════════════════════════════════════════════
STRICT ANONYMISATION RULES — NON-NEGOTIABLE:
1. Remove ALL proper nouns: names of people, places, companies, institutions, brands, public figures.
2. Remove ALL personal details: profession, relationships, health, location, life events, dates, economic status, or any other identifying detail.
3. If the original text contains "as a surgeon" or "after my divorce" or "in Naples" — REWRITE completely without those references. The technique must be extractable with no trace of who said it.
4. The technique description must be fully intelligible to someone who has never seen this conversation.
5. If it is impossible to extract a genuinely anonymised technique (the content is too personal or anecdotal to generalise), return {"skip": true}.
════════════════════════════════════════════════════

OUTPUT — valid JSON only, no markdown fences:
{
  "technique": "<Italian. 30–70 words. Infinitive verb to start (e.g. 'Identificare le premesse implicite...'). Describe the cognitive move, not the topic. No proper nouns. No personal references.>",
  "category": "<one of: philosophy | science | ethics | technology | society | knowledge | consciousness>",
  "archetype": "<one of: Il Cartografo | Il Notaio | L'Architetto | Il Revisore | Il Visionario | Il Tessitore | Lo Sperimentatore | Il Fondamentalista — or null if not clearly applicable>"
}

If you cannot extract a valid, anonymisable technique, return:
{"skip": true}
`.trim();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wordSet(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(w => w.length > 3),
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const sa = wordSet(a);
  const sb = wordSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersection = 0;
  for (const w of sa) if (sb.has(w)) intersection++;
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ─── Cooldown & duplicate checks ──────────────────────────────────────────────

/** Returns true if this userId/source has a signal within the last COOLDOWN_HOURS. */
async function isCoolingDown(userId: number): Promise<boolean> {
  const since = new Date(Date.now() - COOLDOWN_HOURS * 3600 * 1000);
  const rows = await db.select({ id: bestPracticeSignals.id })
    .from(bestPracticeSignals)
    .where(and(
      eq(bestPracticeSignals.userId, userId),
      gte(bestPracticeSignals.createdAt, since),
    ))
    .limit(1);
  return rows.length > 0;
}

/** Returns true if this exact conversationId already has a signal (per-convo dedup). */
async function alreadySignaledForConvo(userId: number, sourceConvoId: number): Promise<boolean> {
  const rows = await db.select({ id: bestPracticeSignals.id })
    .from(bestPracticeSignals)
    .where(and(
      eq(bestPracticeSignals.userId, userId),
      eq(bestPracticeSignals.sourceConvoId, sourceConvoId),
    ))
    .limit(1);
  return rows.length > 0;
}

/** Returns true if this matchId already has a signal (per-match dedup). */
async function alreadySignaledForMatch(userId: number, sourceMatchId: string): Promise<boolean> {
  const rows = await db.execute(sql`
    SELECT id FROM best_practice_signals
    WHERE user_id = ${userId} AND source_match_id = ${sourceMatchId}
    LIMIT 1
  `);
  return rows.rows.length > 0;
}

/** Returns true if an existing published best practice in the same category is too similar. */
async function isDuplicate(technique: string, category: string): Promise<boolean> {
  const existing = await db.select({ synthesizedText: bestPractices.synthesizedText })
    .from(bestPractices)
    .where(and(
      eq(bestPractices.category, category),
      eq(bestPractices.status, "published"),
    ))
    .limit(50);

  for (const row of existing) {
    if (jaccardSimilarity(technique, row.synthesizedText) >= DUPLICATE_JACCARD_THRESHOLD) {
      return true;
    }
  }
  return false;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates and stores a best-practice proposal for the given user.
 *
 * Pipeline:
 *   1. Per-conversation / per-match dedup check (early exit if already proposed)
 *   2. 48h global cooldown check (popup-fatigue prevention)
 *   3. pg_advisory_lock (userId + 200_000) — prevents concurrent duplicate generation
 *   4. LLM call (Claude Haiku) with full anonymisation instructions + 8s timeout guard
 *   5. Post-generation validation: min-word count + Jaccard duplicate check
 *   6. INSERT into best_practices (status="proposed", expiresAt=+72h)
 *   7. INSERT into best_practice_signals (for dedup + analytics)
 *
 * On any error (LLM, timeout, parse, validation) — silently returns. Never throws.
 */
export async function generateBestPractice(params: GenerateBestPracticeParams): Promise<void> {
  const { userId, source, triggerType, userTurns, category, sourceConvoId, sourceMatchId } = params;

  if (!userTurns.trim()) return;

  // ── 1. Per-source dedup ───────────────────────────────────────────────────
  try {
    if (sourceConvoId && await alreadySignaledForConvo(userId, sourceConvoId)) return;
    if (sourceMatchId && await alreadySignaledForMatch(userId, sourceMatchId)) return;

    // ── 2. 48h global cooldown ────────────────────────────────────────────────
    if (await isCoolingDown(userId)) return;
  } catch {
    return;
  }

  // ── 3. Advisory lock ─────────────────────────────────────────────────────
  const lockKey = userId + LOCK_OFFSET;
  try {
    const lockRes = await db.execute(sql`SELECT pg_try_advisory_lock(${lockKey})`);
    if (!(lockRes.rows[0] as { pg_try_advisory_lock: boolean })?.pg_try_advisory_lock) {
      // Another concurrent call is already generating for this user — skip silently.
      await db.execute(sql`SELECT pg_advisory_lock(${lockKey})`);
      await db.execute(sql`SELECT pg_advisory_unlock(${lockKey})`);
      return;
    }
  } catch {
    return;
  }

  try {
    // ── 4. LLM call with timeout guard ───────────────────────────────────────
    const categoryHint = category ?? "unknown";
    const prompt = BEST_PRACTICE_PROMPT(userTurns, categoryHint);

    let rawOutput: string | null = null;
    try {
      const callPromise = anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 150,
        temperature: 0.5,
        messages: [{ role: "user", content: prompt }],
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("best-practice generation timeout")), 8_000),
      );
      const response = await Promise.race([callPromise, timeoutPromise]);
      rawOutput = (response.content[0] as { type: string; text?: string })?.text ?? null;
    } catch {
      return;
    }

    if (!rawOutput) return;

    // ── 5a. Parse JSON ────────────────────────────────────────────────────────
    let parsed: Record<string, unknown>;
    try {
      const cleaned = rawOutput.replace(/```json\s*|```/g, "").trim();
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return;
    }

    // Model signalled it cannot anonymise this content — skip.
    if (parsed["skip"] === true) return;

    const technique = typeof parsed["technique"] === "string" ? parsed["technique"].trim() : null;
    const resolvedCategory = typeof parsed["category"] === "string" ? parsed["category"] : (category ?? "philosophy");
    const archetype = typeof parsed["archetype"] === "string" && parsed["archetype"] !== "null"
      ? parsed["archetype"]
      : null;

    if (!technique) return;

    // ── 5b. Min-word validation ───────────────────────────────────────────────
    const wordCount = technique.split(/\s+/).filter(Boolean).length;
    if (wordCount < MIN_WORDS) return;

    // ── 5c. Duplicate check ───────────────────────────────────────────────────
    if (await isDuplicate(technique, resolvedCategory)) return;

    // ── 6. INSERT best_practice ───────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + EXPIRES_HOURS * 3600 * 1000);

    const [inserted] = await db.insert(bestPractices).values({
      source,
      sourceConvoId: sourceConvoId ?? null,
      sourceMatchId: sourceMatchId ?? null,
      category: resolvedCategory,
      archetype,
      synthesizedText: technique,
      triggerType,
      savedCount: 0,
      status: "proposed",
      expiresAt,
    }).returning({ id: bestPractices.id });

    if (!inserted) return;

    // ── 7. INSERT signal (dedup record + analytics) ───────────────────────────
    await db.insert(bestPracticeSignals).values({
      userId,
      sourceConvoId: sourceConvoId ?? null,
      sourceMatchId: sourceMatchId ?? null,
      signalType: triggerType === "inferred"
        ? "inferred"
        : source === "battle" ? "explicit_battle" : "explicit_chat",
      proposedId: inserted.id,
    });

  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${lockKey})`);
  }
}
