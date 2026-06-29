import { pgTable, uuid, text, integer, jsonb, timestamp, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { threads, type SessionMessage, type BattleAnswerScore } from "./threads";

// ─── ASYNC USER-vs-USER battle ───────────────────────────────────────────────
// A "match" pairs two real users on the SAME shared theme. Each player has their
// own turn-based, server-timed (390s) conversation WITH an AI sparring partner.
// When BOTH entries are completed, their USER messages are scored head-to-head
// (one LLM call) on density + persuasiveness; the denser/more convincing wins.
// Play is ASYNC: the two players need not be online at the same time.

export type PvpMatchStatus = "waiting" | "active" | "scoring" | "completed" | "abandoned";
export type PvpEntryStatus = "matched" | "in_progress" | "completed" | "forfeit";

// Persisted head-to-head comparison result (server-computed, never client-supplied).
export interface PvpComparison {
  winner: "slot1" | "slot2" | "tie";
  reasoning: string;
  slot1RawScore: number;
  slot2RawScore: number;
}

export const battleMatches = pgTable("battle_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").references(() => threads.id, { onDelete: "set null" }),
  theme: text("theme").notNull(),
  category: text("category").default("philosophy"),
  status: text("status").$type<PvpMatchStatus>().notNull().default("waiting"),
  winnerUserId: text("winner_user_id"), // clerk id of the winner (null until resolved / on tie)
  tie: boolean("tie").notNull().default(false),
  vsAi: boolean("vs_ai").notNull().default(false),
  comparison: jsonb("comparison").$type<PvpComparison>(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("battle_matches_status_idx").on(t.status),
  index("battle_matches_created_idx").on(t.createdAt),
]);

export const battleEntries = pgTable("battle_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => battleMatches.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),       // clerk id
  username: text("username"),
  slot: integer("slot").notNull(),         // 1 | 2
  status: text("status").$type<PvpEntryStatus>().notNull().default("matched"),
  messages: jsonb("messages").default([]).$type<SessionMessage[]>(),
  userText: text("user_text"),             // concatenation of THIS player's user messages (scoring input)
  score: jsonb("score").$type<BattleAnswerScore>(),
  rawScore: integer("raw_score").default(0),
  xpAwarded: integer("xp_awarded").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),     // set once; anchors the 390s server timer
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastTurnAt: timestamp("last_turn_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("battle_entries_match_user_idx").on(t.matchId, t.userId),
  uniqueIndex("battle_entries_match_slot_idx").on(t.matchId, t.slot),
  // A user can only ever have ONE open entry (prevents joining/creating multiple
  // battles at once). Enforced at the DB level for race-safety.
  uniqueIndex("battle_entries_open_user_idx")
    .on(t.userId)
    .where(sql`status in ('matched', 'in_progress')`),
  index("battle_entries_user_idx").on(t.userId),
]);

export type BattleMatch = typeof battleMatches.$inferSelect;
export type NewBattleMatch = typeof battleMatches.$inferInsert;
export type BattleEntry = typeof battleEntries.$inferSelect;
export type NewBattleEntry = typeof battleEntries.$inferInsert;
