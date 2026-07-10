import { db } from "@workspace/db";
import { jobRuns } from "@workspace/db";
import { eq } from "drizzle-orm";

// Watermark for "what changed since the last successful run" queries. Written
// ONLY after a job completes with no errors — a failed run must NOT advance
// the watermark, or the events that happened during the failed window are
// silently skipped forever (never notified).
export async function getLastCompletedAt(jobName: string): Promise<Date> {
  const [row] = await db.select().from(jobRuns).where(eq(jobRuns.jobName, jobName)).limit(1);
  // First-ever run: default to 1h ago rather than epoch, so a brand-new job
  // doesn't try to backfill notifications for years of historical data.
  return row?.lastCompletedAt ?? new Date(Date.now() - 60 * 60 * 1000);
}

export async function markJobCompleted(jobName: string, completedAt: Date): Promise<void> {
  await db.insert(jobRuns)
    .values({ jobName, lastCompletedAt: completedAt })
    .onConflictDoUpdate({ target: jobRuns.jobName, set: { lastCompletedAt: completedAt } });
}
