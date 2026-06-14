import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeKey: text("badge_key").notNull(),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBadgeSchema = createInsertSchema(badges).omit({ id: true, earnedAt: true });
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type Badge = typeof badges.$inferSelect;
