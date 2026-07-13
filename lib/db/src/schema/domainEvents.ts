import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { conversations } from "./conversations";

export const domainEvents = pgTable("domain_events", {
  id:             serial("id").primaryKey(),
  userId:         integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  domain:         text("domain").notNull(),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDomainEventSchema = createInsertSchema(domainEvents).omit({ id: true, createdAt: true });
export type InsertDomainEvent = z.infer<typeof insertDomainEventSchema>;
export type DomainEvent = typeof domainEvents.$inferSelect;
