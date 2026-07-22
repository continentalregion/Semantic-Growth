import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { conversations } from "./conversations";
import { bestPractices } from "./bestPractices";

// Tracks every detected signal (explicit or inferred) that led to a best-
// practice proposal, for two purposes:
//   1. De-duplication — do not propose a best practice for the same
//      conversation/match twice (check sourceConvoId / sourceMatchId before
//      triggering generation).
//   2. Funnel analytics — compare explicit vs. inferred conversion rates.
//
// proposedId is nullable: it is null while generation is in-flight, then
// populated once the best_practices row is inserted.
export const bestPracticeSignals = pgTable("best_practice_signals", {
  id:             serial("id").primaryKey(),
  userId:         integer("user_id").notNull()
                    .references(() => users.id, { onDelete: "cascade" }),
  sourceConvoId:  integer("source_convo_id")
                    .references(() => conversations.id, { onDelete: "cascade" }),
  sourceMatchId:  text("source_match_id"),   // nullable — battle_matches.id
  signalType:     text("signal_type").notNull(),
  // "explicit_chat" | "explicit_battle" | "inferred"
  proposedId:     integer("proposed_id")
                    .references(() => bestPractices.id, { onDelete: "set null" }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BestPracticeSignal    = typeof bestPracticeSignals.$inferSelect;
export type NewBestPracticeSignal = typeof bestPracticeSignals.$inferInsert;
