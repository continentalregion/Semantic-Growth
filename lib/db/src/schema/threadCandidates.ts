import { pgTable, uuid, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { conversations } from "./conversations";

// Pre-publication holding area for AI-proposed threads. A candidate is NEVER
// written into `threads` (and never publicly visible) until a human confirms
// it — see threads.ts audit: the old maybeCreateThreadFromConversation()
// published straight to `threads` with zero review, which is the gap this
// table closes. status transitions: pending -> confirmed | discarded.
// Confirmed candidates are moved into `threads` and the candidate row is left
// as history (resolvedAt set); discarded candidates are also kept for
// debugging/metrics rather than hard-deleted, since they hold no PII beyond
// what `threads` itself would already expose once anonymized.
export const threadCandidates = pgTable("thread_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceConversationId: integer("source_conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  question: text("question").notNull(),
  aiTitle: text("ai_title"),
  description: text("description"),
  category: text("category").default("philosophy"),
  motivationBlurb: text("motivation_blurb"),
  metricsSnapshot: jsonb("metrics_snapshot"),
  status: text("status").notNull().default("pending"), // "pending" | "confirmed" | "discarded"
  publishedThreadId: uuid("published_thread_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export type ThreadCandidate = typeof threadCandidates.$inferSelect;
export type NewThreadCandidate = typeof threadCandidates.$inferInsert;
