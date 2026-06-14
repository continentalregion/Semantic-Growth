import { pgTable, serial, integer, text, real, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const semanticDomains = pgTable("semantic_domains", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  explorationScore: real("exploration_score").notNull().default(0),
  messageCount: integer("message_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userDomainUnique: unique("semantic_domains_user_domain_unique").on(t.userId, t.domain),
}));

export const insertSemanticDomainSchema = createInsertSchema(semanticDomains).omit({ id: true, updatedAt: true });
export type InsertSemanticDomain = z.infer<typeof insertSemanticDomainSchema>;
export type SemanticDomain = typeof semanticDomains.$inferSelect;
