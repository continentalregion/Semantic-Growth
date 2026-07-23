import { db } from "@workspace/db";
import { aiInferredFacts } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const EXTRACT_PROMPT = (
  msgs: Array<{ role: string; content: string }>,
  existingFacts: Array<{ id: number; fact: string }>,
) => `
You are analyzing a conversation to extract stable personal facts about the user.

EXISTING FACTS ALREADY KNOWN (id + text):
${existingFacts.length > 0
  ? existingFacts.map(f => `- id=${f.id}: ${f.fact}`).join("\n")
  : "(none yet)"}

RECENT CONVERSATION (last messages):
${msgs.map(m => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 300)}`).join("\n\n")}

TASK: Identify stable personal facts about the user from the conversation above.
- A "fact" is a relatively stable trait, occupation, interest, value, or situation (NOT a temporary opinion or one-off comment).
- For each new fact, classify persistenceLevel:
    "alta"  = very stable (profession, deep values, chronic condition, fixed location)
    "media" = moderately stable (current project, ongoing study, life phase)
    "bassa" = potentially temporary (current mood, recent activity, passing interest)
- If a new fact is semantically equivalent to one already in the EXISTING FACTS list, respond with action "reinforce" + the existing id — do NOT create a duplicate.
- If nothing worth extracting, return { "facts": [] }.

Respond ONLY with valid JSON (no markdown):
{"facts": [
  {"action": "new", "fact": "<max 200 chars>", "persistenceLevel": "alta"|"media"|"bassa"},
  {"action": "reinforce", "existingId": <number>}
]}
`.trim();

export async function maybeExtractInferredFacts(
  history: Array<{ role: string; content: string }>,
  userId: number,
  convoId: number | null,
): Promise<void> {
  try {
    if (history.length < 4) return;

    const existing = await db
      .select({ id: aiInferredFacts.id, fact: aiInferredFacts.fact })
      .from(aiInferredFacts)
      .where(
        and(
          eq(aiInferredFacts.userId, userId),
          inArray(aiInferredFacts.status, ["active", "stale"]),
        ),
      )
      .limit(20);

    const msgs = history.slice(-10);

    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      messages: [{ role: "user", content: EXTRACT_PROMPT(msgs, existing) }],
      max_tokens: 400,
    });

    const raw = (resp.content[0] as { type: string; text?: string })?.text ?? "{}";
    const parsed = JSON.parse(raw) as {
      facts?: Array<
        | { action: "new"; fact: string; persistenceLevel: "alta" | "media" | "bassa" }
        | { action: "reinforce"; existingId: number }
      >;
    };

    if (!parsed.facts || !Array.isArray(parsed.facts) || parsed.facts.length === 0) return;

    const now = new Date();

    for (const item of parsed.facts) {
      if (item.action === "new") {
        const fact = item.fact?.trim().slice(0, 200);
        if (!fact) continue;
        await db.insert(aiInferredFacts).values({
          userId,
          fact,
          persistenceLevel: item.persistenceLevel,
          status: "candidate",
          sourceConversationId: convoId,
        });
      } else if (item.action === "reinforce" && typeof item.existingId === "number") {
        await db
          .update(aiInferredFacts)
          .set({
            lastReinforcedAt: now,
            sourceConversationId: convoId,
            status: "active",
            updatedAt: now,
          })
          .where(and(eq(aiInferredFacts.id, item.existingId), eq(aiInferredFacts.userId, userId)));
      }
    }
  } catch {
    // Fire-and-forget: never propagate errors to the caller
  }
}
