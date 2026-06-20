import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const blockedAttempts = pgTable("blocked_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(),
  reason: text("reason").notNull(),         // "monthly_limit" | "global_budget"
  model: text("model"),
  used: integer("used").notNull(),
  limit: integer("limit").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BlockedAttempt = typeof blockedAttempts.$inferSelect;
