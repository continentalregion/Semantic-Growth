import { db, users } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

type DbUser = typeof users.$inferSelect;

const PLAN_RANK: Record<string, number> = { free: 0, premium: 1, pro: 2 };

/**
 * Derives the user's plan from their active/trialing Stripe subscriptions
 * (synced into the local `stripe` schema) and persists it on the users row.
 *
 * Gated on `stripeCustomerId`: users without one (e.g. the email-based admin
 * overrides applied at startup) are returned untouched. Best-effort — any
 * failure returns the user unchanged so the auth hot path never breaks.
 */
export async function reconcileStripePlanForUser(user: DbUser): Promise<DbUser> {
  if (!user.stripeCustomerId) return user;

  try {
    const result = await db.execute(sql`
      SELECT pr.metadata->>'plan' AS price_plan, prod.metadata->>'plan' AS product_plan
      FROM stripe.subscriptions s
      JOIN stripe.subscription_items si ON si.subscription = s.id
      JOIN stripe.prices pr ON pr.id = si.price
      LEFT JOIN stripe.products prod ON prod.id = pr.product
      WHERE s.customer = ${user.stripeCustomerId}
        AND s.status IN ('active', 'trialing')
    `);

    let best = "free";
    for (const row of result.rows as Array<{ price_plan: string | null; product_plan: string | null }>) {
      const plan = (row.price_plan ?? row.product_plan ?? "").toString();
      if (plan in PLAN_RANK && PLAN_RANK[plan] > PLAN_RANK[best]) best = plan;
    }

    if (best !== user.plan) {
      const [updated] = await db
        .update(users)
        .set({ plan: best })
        .where(eq(users.id, user.id))
        .returning();
      return updated ?? { ...user, plan: best };
    }
    return user;
  } catch (err) {
    console.error("[reconcileStripePlan] failed:", err);
    return user;
  }
}
