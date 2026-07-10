import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Tracks the last successful completion of each recurring background job
// (e.g. the notifications sweep). Read to compute "what changed since last
// time" windows; written only after a run finishes with no errors, so a
// failed run never advances the watermark and gets retried on the next tick.
export const jobRuns = pgTable("job_runs", {
  jobName: text("job_name").primaryKey(),
  lastCompletedAt: timestamp("last_completed_at", { withTimezone: true }).notNull(),
});

export const insertJobRunSchema = createInsertSchema(jobRuns);
export type InsertJobRun = z.infer<typeof insertJobRunSchema>;
export type JobRun = typeof jobRuns.$inferSelect;
