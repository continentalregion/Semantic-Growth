import { db } from "@workspace/db";
import { bestPracticeTopics } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

// Maximum topics fetched per macro-category for the matching prompt.
const MAX_TOPICS_IN_PROMPT = 30;

// Shared 8s timeout — same pattern as generateBestPractice.ts.
const TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`matchOrCreateTopic timeout after ${ms}ms`)), ms),
    ),
  ]);
}

// ─── Label generation (cold start — no existing topics in category) ───────────

const LABEL_PROMPT = (technique: string) => `
Sei un curatore di una libreria condivisa di tecniche di ragionamento.

Tecnica estratta:
"${technique.slice(0, 300)}"

Genera UN'etichetta tematica sintetica (4-7 parole in italiano) che identifichi il NUCLEO COGNITIVO di questa tecnica — non il topic generico, ma il movimento mentale specifico.
Esempi di buone etichette: "Smontare le premesse implicite", "Falsificare le ipotesi alternative", "Ancorare l'astratto al concreto".

Rispondi SOLO con l'etichetta. Nessuna punteggiatura finale, nessuna spiegazione.
`.trim();

// ─── Matching prompt (existing topics present) ────────────────────────────────

const MATCH_PROMPT = (
  macroCategory: string,
  topics: { id: number; label: string }[],
  technique: string,
) => `
Sei un curatore di una libreria condivisa di tecniche di ragionamento.

Temi esistenti nella categoria "${macroCategory}":
${topics.map((t, i) => `[${i + 1}] ${t.label}`).join("\n")}

Nuova tecnica:
"${technique.slice(0, 400)}"

Rispondi SOLO con UNA delle due opzioni:
- Il NUMERO del tema più affine, SE la tecnica rientra chiaramente in uno esistente (il nucleo cognitivo è lo stesso, non solo il topic generico)
- "new:<etichetta sintetica 4-7 parole in italiano>" se nessun tema esistente è abbastanza specifico

Esempi di risposta valida: "3" oppure "new:Falsificare le ipotesi alternative"
Nessuna spiegazione, nessun testo aggiuntivo.
`.trim();

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Finds or creates a best_practice_topics row for the given technique and
 * macro-category.
 *
 * Returns the topic id (existing or newly created), or null on any error /
 * timeout. A null return is NON-BLOCKING — callers must proceed with the
 * best_practice INSERT regardless.
 *
 * Pipeline:
 *   1. Fetch up to 30 existing topics in the macro-category (by resolution_count DESC)
 *   2a. If 0 topics → ask Claude for a label → INSERT new topic → return id
 *   2b. If N > 0 topics → ask Claude to pick existing or propose new label
 *       → if valid index returned → return existing topicId
 *       → if "new:<label>" returned → INSERT new topic → return id
 *       → if malformed / timeout → return null
 */
export async function matchOrCreateTopic(
  technique: string,
  macroCategory: string,
): Promise<number | null> {
  try {
    // ── 1. Fetch existing topics ──────────────────────────────────────────────
    const existing = await db
      .select({ id: bestPracticeTopics.id, label: bestPracticeTopics.label })
      .from(bestPracticeTopics)
      .where(eq(bestPracticeTopics.macroCategory, macroCategory))
      .orderBy(desc(bestPracticeTopics.resolutionCount))
      .limit(MAX_TOPICS_IN_PROMPT);

    // ── 2a. Cold start: no topics yet — generate label and INSERT ─────────────
    if (existing.length === 0) {
      const label = await generateLabel(technique);
      if (!label) return null;
      return await insertTopic(macroCategory, label);
    }

    // ── 2b. Match against existing topics ────────────────────────────────────
    const prompt = MATCH_PROMPT(macroCategory, existing, technique);
    let rawReply: string | null = null;

    try {
      const response = await withTimeout(
        anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 60,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        }),
        TIMEOUT_MS,
      );
      rawReply = (response.content[0] as { type: string; text?: string })?.text?.trim() ?? null;
    } catch {
      return null;
    }

    if (!rawReply) return null;

    // ── Parse: integer index → existing topic ─────────────────────────────────
    const idx = parseInt(rawReply, 10);
    if (Number.isFinite(idx) && idx >= 1 && idx <= existing.length) {
      return existing[idx - 1]!.id;
    }

    // ── Parse: "new:<label>" → INSERT new topic ───────────────────────────────
    if (rawReply.toLowerCase().startsWith("new:")) {
      const label = rawReply.slice(4).trim();
      if (label.length >= 3) {
        return await insertTopic(macroCategory, label);
      }
    }

    // Malformed response — non-blocking, return null
    console.warn("[matchOrCreateTopic] Unrecognised reply:", rawReply);
    return null;

  } catch (err) {
    console.error("[matchOrCreateTopic] Unexpected error:", err);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateLabel(technique: string): Promise<string | null> {
  try {
    const response = await withTimeout(
      anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 30,
        temperature: 0.3,
        messages: [{ role: "user", content: LABEL_PROMPT(technique) }],
      }),
      TIMEOUT_MS,
    );
    const label = (response.content[0] as { type: string; text?: string })?.text?.trim() ?? null;
    return label && label.length >= 3 ? label : null;
  } catch {
    return null;
  }
}

async function insertTopic(macroCategory: string, label: string): Promise<number | null> {
  try {
    // ON CONFLICT DO NOTHING handles the race where two concurrent proposals
    // in the same cold-start category both try to INSERT the same label.
    // Re-SELECT by (macroCategory, label) — the unique key — to get the id
    // whether we inserted or lost the race.
    await db
      .insert(bestPracticeTopics)
      .values({ macroCategory, label })
      .onConflictDoNothing();

    const { and: drizzleAnd } = await import("drizzle-orm");
    const [row] = await db
      .select({ id: bestPracticeTopics.id })
      .from(bestPracticeTopics)
      .where(drizzleAnd(
        eq(bestPracticeTopics.macroCategory, macroCategory),
        eq(bestPracticeTopics.label, label),
      ))
      .limit(1);

    return row?.id ?? null;
  } catch (err) {
    console.error("[matchOrCreateTopic] insertTopic error:", err);
    return null;
  }
}
