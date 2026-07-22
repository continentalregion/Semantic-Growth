import { pgTable, serial, text, integer, timestamp, index, unique } from "drizzle-orm/pg-core";

// Thematic groupings within the Best Practice Library. Each topic belongs to
// one of the 3 Library macro-categories (philosophy | behavioral_automatisms |
// ethics) and aggregates all published best_practices whose core cognitive move
// has been judged equivalent by the LLM matching step (Fase B').
//
// resolutionCount is denormalised: incremented when a best_practice with this
// topicId transitions proposed → published (in PATCH /best-practices/:id/status).
// It is never decremented — hard-deleted (rejected) proposals never reached
// "published" status, so they never incremented the counter.
//
// label is the short thematic label shown in the Library UI (4-7 Italian words,
// e.g. "Smontare le premesse implicite"). It is unique within a macro-category
// so that the LLM matching step can safely use it as an identifier.
export const bestPracticeTopics = pgTable(
  "best_practice_topics",
  {
    id:              serial("id").primaryKey(),
    macroCategory:   text("macro_category").notNull(),
    // "philosophy" | "behavioral_automatisms" | "ethics"
    // These 3 values are INDEPENDENT from the 7-category taxonomy used by
    // Thread Aperti (threads.tsx). Do not conflate them.
    label:           text("label").notNull(),
    resolutionCount: integer("resolution_count").notNull().default(0),
    createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bpt_macro_category_idx").on(t.macroCategory),
    unique("bpt_macro_category_label_unique").on(t.macroCategory, t.label),
  ],
);

export type BestPracticeTopic    = typeof bestPracticeTopics.$inferSelect;
export type NewBestPracticeTopic = typeof bestPracticeTopics.$inferInsert;
