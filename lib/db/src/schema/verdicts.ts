import { pgTable, serial, integer, text, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users";

export interface SupportingMetricEntry {
  key: string;
  label: string;
  value: number;
  direction: "high" | "low";
}

export interface VerdictSupportingMetrics {
  metric1: SupportingMetricEntry;
  metric2: SupportingMetricEntry;
}

export const verdicts = pgTable("verdicts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  monthKey: text("month_key").notNull(),
  verdict: text("verdict").notNull(),
  archetype: text("archetype").notNull(),
  supportingMetrics: jsonb("supporting_metrics").notNull().$type<VerdictSupportingMetrics>(),
  lifestyleSuggestion: text("lifestyle_suggestion").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  unique("verdicts_user_month_unique").on(t.userId, t.monthKey),
]);

export type Verdict = typeof verdicts.$inferSelect;
