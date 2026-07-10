import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "digest" | "badge" | "battle_result" | "streak_risk"
  titleKey: text("title_key").notNull(),
  bodyKey: text("body_key").notNull(),
  bodyParams: jsonb("body_params"),
  payload: jsonb("payload"),
  deepLink: text("deep_link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  pushSentAt: timestamp("push_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  readAt: true,
  pushSentAt: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
