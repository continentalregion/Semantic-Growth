import { db } from "@workspace/db";
import { aiInferredFacts } from "@workspace/db";
import { and, eq, lt, sql } from "drizzle-orm";
import { markJobCompleted } from "./jobRuns";

const JOB_NAME = "fact_decay";

export async function runFactDecayJob(): Promise<{
  promoted: number;
  stalified: number;
  archived: number;
}> {
  const now = new Date();

  // ── 1. candidate → active: candidates older than 1 day (simple time-based promotion) ──
  const promotedResult = await db
    .update(aiInferredFacts)
    .set({ status: "active", updatedAt: now })
    .where(
      and(
        eq(aiInferredFacts.status, "candidate"),
        lt(aiInferredFacts.firstSeenAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      ),
    );
  const promoted = promotedResult.rowCount ?? 0;

  // ── 2. active → stale by persistenceLevel ──────────────────────────────────
  const stalifiedResult = await db.execute(sql`
    UPDATE ai_inferred_facts
    SET status = 'stale', updated_at = NOW()
    WHERE status = 'active'
      AND (
        (persistence_level = 'alta'  AND last_reinforced_at < NOW() - INTERVAL '90 days')
        OR
        (persistence_level = 'media' AND last_reinforced_at < NOW() - INTERVAL '30 days')
        OR
        (persistence_level = 'bassa' AND last_reinforced_at < NOW() - INTERVAL '7 days')
      )
  `);
  const stalified = (stalifiedResult as any).rowCount ?? 0;

  // ── 3. stale → archived by persistenceLevel ────────────────────────────────
  // alta:  archived after 120d total from last reinforcement (90+30)
  // media: archived after 44d total (30+14)
  // bassa: archived after 14d total (7+7)
  const archivedResult = await db.execute(sql`
    UPDATE ai_inferred_facts
    SET status = 'archived', updated_at = NOW()
    WHERE status = 'stale'
      AND (
        (persistence_level = 'alta'  AND last_reinforced_at < NOW() - INTERVAL '120 days')
        OR
        (persistence_level = 'media' AND last_reinforced_at < NOW() - INTERVAL '44 days')
        OR
        (persistence_level = 'bassa' AND last_reinforced_at < NOW() - INTERVAL '14 days')
      )
  `);
  const archived = (archivedResult as any).rowCount ?? 0;

  await markJobCompleted(JOB_NAME, now);

  return { promoted, stalified, archived };
}
