import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const gamification = pgTable("gamification", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streak: integer("streak").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGamificationSchema = createInsertSchema(gamification).omit({ id: true, updatedAt: true });
export type InsertGamification = z.infer<typeof insertGamificationSchema>;
export type Gamification = typeof gamification.$inferSelect;
