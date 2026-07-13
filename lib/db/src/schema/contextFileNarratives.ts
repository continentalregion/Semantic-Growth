import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const contextFileNarratives = pgTable("context_file_narratives", {
  id:            serial("id").primaryKey(),
  userId:        integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  generatedText: text("generated_text").notNull(),
  generatedAt:   timestamp("generated_at", { withTimezone: true }).notNull(),
  expiresAt:     timestamp("expires_at",   { withTimezone: true }).notNull(),
});

export type ContextFileNarrative = typeof contextFileNarratives.$inferSelect;
