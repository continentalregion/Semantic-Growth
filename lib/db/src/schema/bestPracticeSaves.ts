import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { bestPractices } from "./bestPractices";

// Per-user saves of published best_practices entries.
// savedCount on best_practices is kept in sync (increment on INSERT here,
// decrement on DELETE) — do not rely on COUNT(*) queries for display.
export const bestPracticeSaves = pgTable("best_practice_saves", {
  id:             serial("id").primaryKey(),
  bestPracticeId: integer("best_practice_id").notNull()
                    .references(() => bestPractices.id, { onDelete: "cascade" }),
  userId:         integer("user_id").notNull()
                    .references(() => users.id, { onDelete: "cascade" }),
  savedAt:        timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("bps_best_practice_user_unique").on(t.bestPracticeId, t.userId),
]);

export type BestPracticeSave    = typeof bestPracticeSaves.$inferSelect;
export type NewBestPracticeSave = typeof bestPracticeSaves.$inferInsert;
