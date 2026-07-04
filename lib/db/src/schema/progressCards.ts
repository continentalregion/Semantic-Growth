import { pgTable, uuid, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { conversations } from "./conversations";
import { sgiSnapshots } from "./sgiSnapshots";

// Every 5 user messages inside a single conversation, we compute an early-vs-late
// trend (first 2 vs last 2 of the 5-message window, middle message excluded as a
// neutral pivot) and persist it here so it has a stable, shareable id
// (/progress-card/:id) — same pattern as battle_cards.
export const progressCards = pgTable("progress_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  windowStartSnapshotId: integer("window_start_snapshot_id").notNull().references(() => sgiSnapshots.id),
  windowEndSnapshotId: integer("window_end_snapshot_id").notNull().references(() => sgiSnapshots.id),
  earlyAvg: real("early_avg").notNull(),
  lateAvg: real("late_avg").notNull(),
  deltaPct: real("delta_pct").notNull(),
  highlightMetric: text("highlight_metric").notNull(),
  highlightDeltaPct: real("highlight_delta_pct").notNull(),
  // Short (1-2 line) LLM-generated qualitative phrase, localized to the user's
  // UI language at generation time. Nullable by design: if the Haiku call
  // fails/times out/returns empty, the card still renders with numeric data
  // only (see generateProgressInsight in api-server/src/lib/progressCardInsight.ts).
  insightText: text("insight_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ProgressCard = typeof progressCards.$inferSelect;
export type InsertProgressCard = typeof progressCards.$inferInsert;
