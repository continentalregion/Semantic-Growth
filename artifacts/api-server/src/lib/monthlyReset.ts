/**
 * Shared monthly-counter reset, used by both chat.ts (messages/opus/aiCost)
 * and userBattleUsage.ts (battles). All monthly counters share the single
 * `users.monthly_reset_date` gate column, so the reset MUST touch every
 * monthly counter at once — otherwise whichever subsystem runs first in a
 * new month "claims" the reset date and the other subsystem's counter goes
 * stale (never zeroed) because it sees the date already matches this month.
 */

import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq } from "drizzle-orm";

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export interface MonthlyCountersUser {
  monthlyResetDate: string | null;
  monthlyMessagesUsed: number;
  opusMessagesUsed: number;
  aiCostCents: number;
  monthlyBattlesUsed: number;
}

export interface MonthlyCountersResult {
  messagesUsed: number;
  battlesUsed: number;
}

/**
 * If the user's monthlyResetDate is not the current month, zeroes ALL monthly
 * counters (messages, opus, aiCost, battles) atomically and returns the
 * post-reset values. Otherwise returns the current values unchanged.
 */
export async function resetAllMonthlyCountersIfNeeded(
  userId: number,
  user: MonthlyCountersUser,
): Promise<MonthlyCountersResult> {
  const thisMonth = currentMonthKey();
  if (user.monthlyResetDate !== thisMonth) {
    await db.update(users)
      .set({
        monthlyMessagesUsed: 0,
        opusMessagesUsed: 0,
        aiCostCents: 0,
        monthlyBattlesUsed: 0,
        monthlyResetDate: thisMonth,
      })
      .where(eq(users.id, userId));
    return { messagesUsed: 0, battlesUsed: 0 };
  }
  return { messagesUsed: user.monthlyMessagesUsed, battlesUsed: user.monthlyBattlesUsed };
}
