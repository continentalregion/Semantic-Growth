import { pgTable, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { conversations } from "./conversations";

export const sgiSnapshots = pgTable("sgi_snapshots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Nullable, additive — populated going forward only, no historical backfill.
  // Scopes a snapshot to its conversation for the intra-conversation progress-card windowing.
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  score: real("score").notNull(),
  conceptualComplexity: real("conceptual_complexity").notNull().default(0),
  semanticVariety: real("semantic_variety").notNull().default(0),
  interdisciplinaryScore: real("interdisciplinary_score").notNull().default(0),
  reasoningDepth: real("reasoning_depth").notNull().default(0),
  originality: real("originality").notNull().default(0),
  stability: real("stability").notNull().default(0),
  continuity: real("continuity").notNull().default(0),
  revisionSignal: real("revision_signal").notNull().default(0),
  // Weighted raw score (computeRawScore output, pre-EMA) for THIS message only.
  // Nullable, additive — lets the progress-card feature aggregate via plain SQL,
  // no LLM re-scoring and no re-derivation from the EMA-smoothed `score` above.
  rawScore: real("raw_score"),
  // Nullable, additive — the user's global leaderboard rank AT THE TIME of this
  // snapshot. Populated going forward only (no historical backfill), so that
  // rankChange30d can be computed from a real historical rank instead of being
  // reconstructed from the score via an incompatible formula.
  globalRank: integer("global_rank"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSgiSnapshotSchema = createInsertSchema(sgiSnapshots).omit({ id: true, timestamp: true });
export type InsertSgiSnapshot = z.infer<typeof insertSgiSnapshotSchema>;
export type SgiSnapshot = typeof sgiSnapshots.$inferSelect;
