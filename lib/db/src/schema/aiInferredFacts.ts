import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { conversations } from "./conversations";

export const persistenceLevelEnum = pgEnum("persistence_level", ["alta", "media", "bassa"]);
export const inferredFactStatusEnum = pgEnum("inferred_fact_status", ["candidate", "active", "stale", "archived"]);

export const aiInferredFacts = pgTable("ai_inferred_facts", {
  id:                   serial("id").primaryKey(),
  userId:               integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fact:                 text("fact").notNull(),
  persistenceLevel:     persistenceLevelEnum("persistence_level").notNull(),
  status:               inferredFactStatusEnum("status").notNull().default("candidate"),
  firstSeenAt:          timestamp("first_seen_at",      { withTimezone: true }).notNull().defaultNow(),
  lastReinforcedAt:     timestamp("last_reinforced_at", { withTimezone: true }).notNull().defaultNow(),
  sourceConversationId: integer("source_conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  updatedAt:            timestamp("updated_at",         { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAiInferredFactSchema = createInsertSchema(aiInferredFacts)
  .omit({ id: true, firstSeenAt: true, updatedAt: true });
export type InsertAiInferredFact = z.infer<typeof insertAiInferredFactSchema>;
export type AiInferredFact = typeof aiInferredFacts.$inferSelect;
