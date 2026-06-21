import { pgTable, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const sgiSnapshots = pgTable("sgi_snapshots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  score: real("score").notNull(),
  conceptualComplexity: real("conceptual_complexity").notNull().default(0),
  semanticVariety: real("semantic_variety").notNull().default(0),
  interdisciplinaryScore: real("interdisciplinary_score").notNull().default(0),
  reasoningDepth: real("reasoning_depth").notNull().default(0),
  originality: real("originality").notNull().default(0),
  stability: real("stability").notNull().default(0),
  continuity: real("continuity").notNull().default(0),
  revisionSignal: real("revision_signal").notNull().default(0),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSgiSnapshotSchema = createInsertSchema(sgiSnapshots).omit({ id: true, timestamp: true });
export type InsertSgiSnapshot = z.infer<typeof insertSgiSnapshotSchema>;
export type SgiSnapshot = typeof sgiSnapshots.$inferSelect;
