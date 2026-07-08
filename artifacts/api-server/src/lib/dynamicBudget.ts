/**
 * Dynamic LLM budget caps derived from real Stripe MRR.
 *
 * Caps are the MAX of a hard-coded floor (from pricing.ts) and a percentage of
 * live MRR so that spending limits scale automatically with revenue:
 *   - Battle global cap  = max(BATTLE_MONTHLY_BUDGET_CENTS,  MRR × 15%)
 *   - Chat global cap    = max(GLOBAL_MONTHLY_BUDGET_CENTS,  MRR × 50%)
 *
 * MRR is queried from the Stripe sync tables (stripe.subscriptions / prices)
 * and cached in-memory for 5 minutes to avoid hammering Stripe on every
 * request. On query failure the previous cached value is used as a fallback;
 * if no cache exists yet, 0 is returned (safe: the hard-coded floors still
 * apply via Math.max).
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  BATTLE_MONTHLY_BUDGET_CENTS,
  GLOBAL_MONTHLY_BUDGET_CENTS,
} from "../config/pricing.js";

const MRR_CACHE_TTL_MS = 5 * 60 * 1_000;

let mrrCache: { cents: number; expiresAt: number } | null = null;

async function getCurrentMrrCents(): Promise<number> {
  if (mrrCache && Date.now() < mrrCache.expiresAt) {
    return mrrCache.cents;
  }
  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(pr.unit_amount), 0)::bigint AS total_mrr_cents
      FROM stripe.subscriptions s
      JOIN stripe.subscription_items si ON si.subscription = s.id
      JOIN stripe.prices pr ON pr.id = si.price
      WHERE s.status IN ('active', 'trialing')
    `);
    const row = result.rows[0] as { total_mrr_cents: string | number } | undefined;
    const cents = Number(row?.total_mrr_cents ?? 0);
    mrrCache = { cents, expiresAt: Date.now() + MRR_CACHE_TTL_MS };
    return cents;
  } catch (err) {
    console.warn(
      "[dynamicBudget] MRR query failed — using cached value or 0:",
      err instanceof Error ? err.message : err,
    );
    return mrrCache?.cents ?? 0;
  }
}

/**
 * Monthly LLM spend cap for battle calls (auth-user + guest combined).
 * = max(BATTLE_MONTHLY_BUDGET_CENTS, MRR × 15%)
 */
export async function getBattleBudgetCapCents(): Promise<number> {
  const mrrCents = await getCurrentMrrCents();
  return Math.max(BATTLE_MONTHLY_BUDGET_CENTS, Math.round(mrrCents * 0.15));
}

/**
 * Monthly LLM spend cap for chat messages (global anti-abuse valve).
 * = max(GLOBAL_MONTHLY_BUDGET_CENTS, MRR × 50%)
 */
export async function getGlobalBudgetCapCents(): Promise<number> {
  const mrrCents = await getCurrentMrrCents();
  return Math.max(GLOBAL_MONTHLY_BUDGET_CENTS, Math.round(mrrCents * 0.50));
}
