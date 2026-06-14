import { pgTable, serial, integer, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  displayName: text("display_name").notNull(),
  sgiScore: real("sgi_score").notNull(),
  rank: integer("rank").notNull(),
  percentile: real("percentile").notNull(),
  rankChange30d: integer("rank_change_30d"),
  isAnonymous: integer("is_anonymous").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeaderboardEntrySchema = createInsertSchema(leaderboardEntries).omit({ id: true, updatedAt: true });
export type InsertLeaderboardEntry = z.infer<typeof insertLeaderboardEntrySchema>;
export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;
