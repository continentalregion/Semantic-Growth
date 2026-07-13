import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const narrativeGenerationLog = pgTable("narrative_generation_log", {
  id:              serial("id").primaryKey(),
  userId:          integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  generatedAt:     timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  inputTokensEst:  integer("input_tokens_est"),
});

export type NarrativeGenerationLog = typeof narrativeGenerationLog.$inferSelect;
