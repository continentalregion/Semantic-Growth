import { db } from "@workspace/db";
import { battleMatches, battleEntries, users, gamification } from "@workspace/db";
import { and, eq, gt, gte, inArray } from "drizzle-orm";
import { reconcileExpiredMatches } from "../routes/battles";
import { createNotification } from "./notifications";
import { getLastCompletedAt, markJobCompleted } from "./jobRuns";

const JOB_NAME = "notifications_sweep";
const MAX_RECONCILE_LOOPS = 20;

// A player's streak breaks at local midnight if they don't play again after
// `lastActiveDate`. We fire the "at risk" nudge once their streak is 1 day
// away from breaking — i.e. their last active day was yesterday (UTC) — so
// there's still a full day left to act on the notification.
function yesterdayUtc(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface SweepResult {
  reconcileLoops: number;
  matchesReconciled: number;
  battleNotificationsSent: number;
  streakRiskNotificationsSent: number;
}

// Runs one full pass of the notifications sweep:
//   1. Drains reconcileExpiredMatches() in a loop until it reports no more
//      work (it internally LIMITs each query, so one call may not catch
//      everything in a single tick).
//   2. Notifies both participants of any battle_matches that completed since
//      the last successful sweep (dedup-guarded via notifications.dedupe_key).
//   3. Notifies users whose streak is one day from breaking.
// Only advances the job_runs watermark if the ENTIRE pass succeeds — a
// partial failure must be retried in full next tick, never silently skipped.
export async function runNotificationSweep(): Promise<SweepResult> {
  const sweepStartedAt = new Date();
  const since = await getLastCompletedAt(JOB_NAME);

  let reconcileLoops = 0;
  let matchesReconciled = 0;
  for (; reconcileLoops < MAX_RECONCILE_LOOPS; reconcileLoops++) {
    const processed = await reconcileExpiredMatches();
    matchesReconciled += processed;
    if (processed === 0) break;
  }

  const battleNotificationsSent = await notifyResolvedBattles(since);
  const streakRiskNotificationsSent = await notifyStreakRisk();

  // Only mark the job complete once every step above returned without throwing.
  await markJobCompleted(JOB_NAME, sweepStartedAt);

  return { reconcileLoops, matchesReconciled, battleNotificationsSent, streakRiskNotificationsSent };
}

async function notifyResolvedBattles(since: Date): Promise<number> {
  const resolved = await db.select().from(battleMatches)
    .where(and(eq(battleMatches.status, "completed"), gte(battleMatches.resolvedAt, since)));
  if (resolved.length === 0) return 0;

  const matchIds = resolved.map(m => m.id);
  const entries = await db.select().from(battleEntries).where(inArray(battleEntries.matchId, matchIds));
  const entriesByMatch = new Map<string, typeof entries>();
  for (const e of entries) {
    const arr = entriesByMatch.get(e.matchId) ?? [];
    arr.push(e);
    entriesByMatch.set(e.matchId, arr);
  }

  // Resolve clerkId -> internal user id for all human participants in one pass.
  const clerkIds = [...new Set(entries.map(e => e.userId))];
  const userRows = clerkIds.length > 0
    ? await db.select({ id: users.id, clerkId: users.clerkId }).from(users).where(inArray(users.clerkId, clerkIds))
    : [];
  const userIdByClerk = new Map(userRows.map(u => [u.clerkId, u.id]));

  let sent = 0;
  for (const match of resolved) {
    const es = entriesByMatch.get(match.id) ?? [];
    for (const entry of es) {
      const userId = userIdByClerk.get(entry.userId);
      if (!userId) continue; // AI player or unregistered — nothing to notify
      const outcome: "win" | "loss" | "tie" = match.tie
        ? "tie"
        : match.winnerUserId === entry.userId ? "win" : "loss";
      await createNotification({
        userId,
        type: "battle_result",
        titleKey: `notifications.battleResult.title.${outcome}`,
        bodyKey: `notifications.battleResult.body.${outcome}`,
        bodyParams: { theme: match.theme },
        payload: { matchId: match.id, outcome },
        deepLink: `/battle/${match.id}`,
        dedupeKey: `battle_result:${userId}:${match.id}`,
      });
      sent++;
    }
  }
  return sent;
}

async function notifyStreakRisk(): Promise<number> {
  const yesterday = yesterdayUtc();
  const today = todayUtc();

  const atRisk = await db.select({ userId: gamification.userId })
    .from(gamification)
    .where(and(
      gt(gamification.streak, 0),
      eq(gamification.lastActiveDate, yesterday),
    ));

  let sent = 0;
  for (const row of atRisk) {
    await createNotification({
      userId: row.userId,
      type: "streak_risk",
      titleKey: "notifications.streakRisk.title",
      bodyKey: "notifications.streakRisk.body",
      payload: {},
      deepLink: "/gamification",
      dedupeKey: `streak_risk:${row.userId}:${today}`,
    });
    sent++;
  }
  return sent;
}
