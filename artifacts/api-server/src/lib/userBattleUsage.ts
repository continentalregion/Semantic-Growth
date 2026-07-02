/**
 * Per-user battle rate limiting (distinct from the aggregate battle_budget €
 * guardrail in battleBudget.ts, which is untouched by this module).
 *
 * Rules:
 *  - Registered users: 8/80/250 battles per month by plan (MONTHLY_BATTLE_LIMITS),
 *    stored on `users.monthly_battles_used`, reset alongside all other monthly
 *    counters via resetAllMonthlyCountersIfNeeded (shared reset gate).
 *  - Carve-out: a user's FIRST-EVER battle (users.first_battle_used_at IS NULL)
 *    is always allowed and does NOT consume a slot in monthly_battles_used —
 *    it is a one-time lifetime grant, not a monthly allowance.
 *  - Soft warning: once monthly_battles_used / limit >= BATTLE_LIMIT_WARNING_RATIO,
 *    responses carry a non-blocking `battleUsage.warning = true` so the frontend
 *    can show a positive-framed upgrade CTA BEFORE the hard stop.
 *  - Guests: no monthly counter (no billing cycle). `guest_usage` exists ONLY to
 *    remember that a guest already spent their carve-out, so a newly-registered
 *    user who claims that guest session doesn't get a SECOND free first battle.
 *  - Fail-open throughout: any DB error allows the battle through, matching the
 *    existing style of battleBudget.ts / guestBattles.ts.
 *
 * Unit of account = 1 BATTLE (match), not 1 turn/message. The count is charged
 * exactly once, at the moment a user becomes a participant in a NEW match
 * (routes/battles.ts matchmake: Phase 2 join OR Phase 3 create). It is
 * deliberately NOT re-checked/re-charged at ai-join, auto-escalation, or each
 * sparring turn — those all operate on a match the user already paid for at
 * matchmake time; charging there too would double count (ai-join/escalation)
 * or wildly over count (a single match has many turns).
 */

import { db } from "@workspace/db";
import { users, type User } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { MONTHLY_BATTLE_LIMITS, BATTLE_LIMIT_WARNING_RATIO } from "../config/pricing.js";
import { resetAllMonthlyCountersIfNeeded } from "./monthlyReset.js";

export interface BattleUsageStatus {
  allowed: boolean;
  isFirstBattle: boolean;
  used: number;
  limit: number;
  warning: boolean;
}

/**
 * Checks whether `user` may start a new battle right now. Resets the monthly
 * counter first if a new month has started. Fails open on DB error.
 */
export async function checkUserBattleAllowed(user: User): Promise<BattleUsageStatus> {
  const limit = MONTHLY_BATTLE_LIMITS[user.plan] ?? MONTHLY_BATTLE_LIMITS.free!;
  try {
    const { battlesUsed } = await resetAllMonthlyCountersIfNeeded(user.id, user);
    const isFirstBattle = !user.firstBattleUsedAt;
    if (isFirstBattle) {
      // Lifetime carve-out: always allowed, no frequency check.
      return { allowed: true, isFirstBattle: true, used: battlesUsed, limit, warning: false };
    }
    const allowed = battlesUsed < limit;
    const warning = allowed && battlesUsed / limit >= BATTLE_LIMIT_WARNING_RATIO;
    return { allowed, isFirstBattle: false, used: battlesUsed, limit, warning };
  } catch (err) {
    console.warn("[userBattleUsage] checkUserBattleAllowed error (fail-open):", err instanceof Error ? err.message : err);
    return { allowed: true, isFirstBattle: false, used: 0, limit, warning: false };
  }
}

/**
 * Records that `userId` just started a new battle. If it was their first-ever
 * battle, only stamps firstBattleUsedAt (does not consume a monthly slot).
 * Otherwise increments monthly_battles_used by 1. Silently swallows errors —
 * usage tracking is best-effort, consistent with chargeBattleBudget().
 */
export async function recordUserBattleUsage(userId: number, isFirstBattle: boolean): Promise<void> {
  try {
    if (isFirstBattle) {
      await db.update(users).set({ firstBattleUsedAt: new Date() }).where(eq(users.id, userId));
    } else {
      await db.update(users)
        .set({ monthlyBattlesUsed: sql`${users.monthlyBattlesUsed} + 1` })
        .where(eq(users.id, userId));
    }
  } catch (err) {
    console.warn("[userBattleUsage] recordUserBattleUsage error:", err instanceof Error ? err.message : err);
  }
}

// ─── Guest usage (carve-out double-dip prevention only, no rate limiting) ─────
// Guests are still gated exclusively by the existing GUEST_MAX_STARTS_PER_IP_PER_DAY
// and guest_budget mechanisms in guestBattles.ts (unchanged). This table only
// remembers a guest's first-battle timestamp so /battles/guest/claim can transfer
// the carve-out state to the newly-registered user, preventing a second free
// "first battle" after signup.
let guestTableReady = false;

async function ensureGuestUsageTable(): Promise<void> {
  if (guestTableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS guest_usage (
      guest_id        TEXT PRIMARY KEY,
      battles_used    INTEGER NOT NULL DEFAULT 0,
      first_battle_at TIMESTAMPTZ
    )
  `);
  guestTableReady = true;
}

/**
 * Records a guest's battle start (fire-and-forget informational tracking).
 * Fails silently — never blocks the guest battle flow.
 */
export async function recordGuestBattleUsage(guestId: string): Promise<void> {
  try {
    await ensureGuestUsageTable();
    await db.execute(sql`
      INSERT INTO guest_usage (guest_id, battles_used, first_battle_at)
      VALUES (${guestId}, 1, now())
      ON CONFLICT (guest_id) DO UPDATE SET battles_used = guest_usage.battles_used + 1
    `);
  } catch (err) {
    console.warn("[userBattleUsage] recordGuestBattleUsage error:", err instanceof Error ? err.message : err);
  }
}

/**
 * Returns the guest's first_battle_at timestamp if they ever battled as a
 * guest, or null otherwise. Fails open (returns null) on DB error.
 */
export async function getGuestFirstBattleAt(guestId: string): Promise<Date | null> {
  try {
    await ensureGuestUsageTable();
    const rows = await db.execute(sql`
      SELECT first_battle_at FROM guest_usage WHERE guest_id = ${guestId}
    `);
    const val = (rows.rows?.[0] as { first_battle_at: string | null } | undefined)?.first_battle_at;
    return val ? new Date(val) : null;
  } catch (err) {
    console.warn("[userBattleUsage] getGuestFirstBattleAt error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Deletes the guest_usage row after a successful claim (cleanup). */
export async function clearGuestUsage(guestId: string): Promise<void> {
  try {
    await ensureGuestUsageTable();
    await db.execute(sql`DELETE FROM guest_usage WHERE guest_id = ${guestId}`);
  } catch (err) {
    console.warn("[userBattleUsage] clearGuestUsage error:", err instanceof Error ? err.message : err);
  }
}
