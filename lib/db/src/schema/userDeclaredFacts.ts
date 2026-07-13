import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const userDeclaredFacts = pgTable("user_declared_facts", {
  id:         serial("id").primaryKey(),
  userId:     integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fact:       text("fact").notNull(),
  isActive:   boolean("is_active").notNull().default(true),
  declaredAt: timestamp("declared_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at",  { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserDeclaredFactSchema = createInsertSchema(userDeclaredFacts)
  .omit({ id: true, declaredAt: true, updatedAt: true });
export type InsertUserDeclaredFact = z.infer<typeof insertUserDeclaredFactSchema>;
export type UserDeclaredFact = typeof userDeclaredFacts.$inferSelect;
