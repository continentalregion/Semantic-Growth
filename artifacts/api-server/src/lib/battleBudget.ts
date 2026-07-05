/**
 * Battle budget guardrail for auth-user LLM calls in battles.ts.
 *
 * Uses a Postgres-backed monthly counter (battle_budget table) analogous to
 * the guest_budget in guestBattles.ts. All functions fail-open: on any DB
 * error the LLM call is allowed through rather than silently dropping it.
 *
 * Call sites:
 *   - generateBattleTheme      → check before, charge after (COST_BATTLE_THEME_CENTS)
 *   - generateAiArgument (esc) → check before, charge after (COST_BATTLE_ARGUMENT_CENTS)
 *   - generateAiArgument (join)→ check before, charge after (COST_BATTLE_ARGUMENT_CENTS)
 *   - sparring turn            → charge after only (COST_BATTLE_SPARRING_CENTS)
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { BATTLE_MONTHLY_BUDGET_CENTS } from "../config/pricing.js";

// Re-exported for existing call sites (battles.ts) — the actual constants
// now live in config/pricing.ts, the single shared source of truth used by
// both the auth-user flow (this file) and the guest flow (guestBattles.ts),
// since both invoke the exact same LLM calls under the hood.
export {
  COST_BATTLE_THEME_CENTS,
  COST_BATTLE_ARGUMENT_CENTS,
  COST_BATTLE_SPARRING_CENTS,
  COST_BATTLE_SCORING_CENTS,
} from "../config/pricing.js";

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS battle_budget (
      month      TEXT PRIMARY KEY,
      used_cents REAL NOT NULL DEFAULT 0
    )
  `);
  tableReady = true;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Returns true if the monthly battle budget has not yet been exhausted.
 * Fails open (returns true) on any DB error.
 */
export async function isBattleBudgetOk(): Promise<boolean> {
  try {
    await ensureTable();
    const month = currentMonth();
    const rows = await db.execute(sql`
      SELECT used_cents FROM battle_budget WHERE month = ${month}
    `);
    const used = Number((rows.rows[0] as { used_cents: number } | undefined)?.used_cents ?? 0);
    return used < BATTLE_MONTHLY_BUDGET_CENTS;
  } catch (err) {
    console.warn("[battleBudget] isBattleBudgetOk error (fail-open):", err instanceof Error ? err.message : err);
    return true;
  }
}

/**
 * Atomically increments the monthly battle spend counter.
 * Silently swallows errors — cost tracking is best-effort.
 */
export async function chargeBattleBudget(cents: number): Promise<void> {
  try {
    await ensureTable();
    const month = currentMonth();
    await db.execute(sql`
      INSERT INTO battle_budget (month, used_cents) VALUES (${month}, ${cents})
      ON CONFLICT (month) DO UPDATE SET used_cents = battle_budget.used_cents + ${cents}
    `);
  } catch (err) {
    console.warn("[battleBudget] chargeBattleBudget error:", err instanceof Error ? err.message : err);
  }
}
