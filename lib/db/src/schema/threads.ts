import { pgTable, uuid, text, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";

export interface ThreadConnection {
  concept1: string;
  concept2: string;
  description: string;
  strength: number;
}

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export const threads = pgTable("threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  description: text("description"),
  category: text("category").default("philosophy"),
  createdBy: text("created_by").notNull(),
  createdByUsername: text("created_by_username"),
  knowledgeBase: jsonb("knowledge_base").default([]).$type<ThreadConnection[]>(),
  totalSessions: integer("total_sessions").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const threadSessions = pgTable("thread_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  username: text("username"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  messages: jsonb("messages").default([]).$type<SessionMessage[]>(),
  connections: jsonb("connections").default([]).$type<ThreadConnection[]>(),
  scoreDensity: integer("score_density").default(0),
  scoreConnections: integer("score_connections").default(0),
  scoreDepth: integer("score_depth").default(0),
  scoreTotal: integer("score_total").default(0),
  scoreExplanation: text("score_explanation"),
  status: text("status").default("in_progress"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const battleCards = pgTable("battle_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
  session1Id: uuid("session1_id").notNull().references(() => threadSessions.id),
  session2Id: uuid("session2_id").notNull().references(() => threadSessions.id),
  winnerSessionId: uuid("winner_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Thread = typeof threads.$inferSelect;
export type ThreadSession = typeof threadSessions.$inferSelect;
export type BattleCard = typeof battleCards.$inferSelect;

// ─── USER vs AI battle (redesigned battle model) ─────────────────────────────
// Self-contained record of one duel: the user's answer and a strong AI answer to
// the same question, BOTH scored by the same 11-metric SGI engine. Stored once
// the battle is committed. Public-feed visibility (winner only, marked "vs AI")
// is controlled by isPublic.
export interface BattleAnswerScore {
  dimensions: Record<string, number>;      // 11 SGI metrics, each 0–10
  macroDimensions: Record<string, number>; // 4 macro dimensions
  domains: string[];
  rawScore: number;                         // 0–100
}

export const aiBattles = pgTable("ai_battles", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),          // clerk id
  username: text("username"),
  question: text("question").notNull(),        // snapshot at battle time
  category: text("category").default("philosophy"),
  userAnswer: text("user_answer").notNull(),
  aiAnswer: text("ai_answer").notNull(),
  userScore: jsonb("user_score").$type<BattleAnswerScore>().notNull(),
  aiScore: jsonb("ai_score").$type<BattleAnswerScore>().notNull(),
  winner: text("winner").notNull(),            // 'user' | 'ai' | 'tie'
  xpAwarded: integer("xp_awarded").notNull().default(0),
  isPublic: boolean("is_public").notNull().default(false), // win → public feed, loss → private
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AiBattle = typeof aiBattles.$inferSelect;
export type NewAiBattle = typeof aiBattles.$inferInsert;
