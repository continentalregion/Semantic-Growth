import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { bestPracticeTopics } from "./bestPracticeTopics";

// Shared, anonymised library of reasoning techniques extracted from Chat and
// Battle sessions. A best practice is NEVER publicly visible until status is
// "published" — same review gate used by thread_candidates.
//
// Status machine:
//   proposed  → published  (admin or auto-approval in future)
//   proposed  → rejected   (DELETE immediately — rejected rows must be hard-
//                            deleted, not retained; they carry synthesised text
//                            that the user did not consent to keep)
//
// expiresAt: set ONLY on "proposed" rows so that unclaimed proposals are
// garbage-collected automatically. On transition to "published" or on hard-
// delete (rejected), expiresAt is irrelevant and can be left as-is.
//
// savedCount is denormalised (incremented/decremented on save/unsave) to keep
// the contextual retrieval query O(1) on the composite index below.
//
// sourceMatchId is stored as text to match the uuid PK of battle_matches
// without introducing a cross-schema FK (battles table lives in same DB but
// is managed separately).
export const bestPractices = pgTable("best_practices", {
  id:             serial("id").primaryKey(),
  source:         text("source").notNull(),          // "chat" | "battle"
  sourceConvoId:  integer("source_convo_id")
                    .references(() => conversations.id, { onDelete: "set null" }),
  sourceMatchId:  text("source_match_id"),            // battle_matches.id (uuid text)
  category:       text("category").notNull().default("philosophy"),
  // 3 macro-categories SPECIFIC to the Best Practice Library — INDEPENDENT from
  // the 7-category taxonomy used by Thread Aperti (threads.tsx). Do not conflate.
  //   "philosophy" | "behavioral_automatisms" | "ethics"
  topicId:        integer("topic_id")
                    .references(() => bestPracticeTopics.id, { onDelete: "set null" }),
  // Nullable FK to best_practice_topics. NULL for rows inserted before Fase B'
  // (topic matching); populated by the matchOrCreateTopic() step in the pipeline.
  archetype:      text("archetype"),                  // from verdicts.archetype if available
  synthesizedText: text("synthesized_text").notNull(),
  triggerType:    text("trigger_type").notNull(),     // "explicit" | "inferred"
  savedCount:     integer("saved_count").notNull().default(0),
  status:         text("status").notNull().default("proposed"),
  // "proposed" | "published" | "rejected"
  // IMPORTANT: "rejected" rows must be hard-deleted by the handler in
  // bestPractices route — do NOT leave them in the table. expiresAt is a
  // fallback GC for "proposed" rows only, not a substitute for immediate
  // deletion on rejection.
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt:      timestamp("expires_at", { withTimezone: true }),
  // Nullable — set only on "proposed" rows (72h TTL); null on published rows.
});

export type BestPractice    = typeof bestPractices.$inferSelect;
export type NewBestPractice = typeof bestPractices.$inferInsert;
