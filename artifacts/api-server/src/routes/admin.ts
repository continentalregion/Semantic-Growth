import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { users, messages, conversations } from "@workspace/db";
import { eq, gte, sql, and } from "drizzle-orm";

const router = Router();

const ADMIN_EMAILS = (process.env.ADMIN_EMAIL ?? "francescoullo1@gmail.com")
  .split(",")
  .map(e => e.trim().toLowerCase());

router.get("/admin/stats", async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) return void res.status(401).json({ error: "Unauthorized" });

  const [caller] = await db.select({ email: users.email, plan: users.plan })
    .from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!caller || !ADMIN_EMAILS.includes((caller.email ?? "").toLowerCase())) {
    return void res.status(403).json({ error: "Admin only" });
  }

  const now = Date.now();
  const h24 = new Date(now - 24 * 60 * 60 * 1000);
  const d7  = new Date(now - 7  * 24 * 60 * 60 * 1000);

  // Real MRR from Stripe (source of truth) — wrapped so a Stripe outage never
  // breaks the monitor; error is surfaced explicitly in the response.
  let stripeRevenue: { activeCount: number; totalMonthlyEur: number; error: string | null } = {
    activeCount: 0,
    totalMonthlyEur: 0,
    error: null,
  };
  try {
    const stripeResult = await db.execute(sql`
      SELECT
        COUNT(DISTINCT s.id)::int AS active_count,
        COALESCE(SUM(pr.unit_amount), 0)::float / 100 AS total_monthly_eur
      FROM stripe.subscriptions s
      JOIN stripe.subscription_items si ON si.subscription = s.id
      JOIN stripe.prices pr ON pr.id = si.price
      WHERE s.status IN ('active', 'trialing')
    `);
    const row = stripeResult.rows[0] as { active_count: number; total_monthly_eur: number } | undefined;
    stripeRevenue = {
      activeCount: Number(row?.active_count ?? 0),
      totalMonthlyEur: Number(row?.total_monthly_eur ?? 0),
      error: null,
    };
  } catch (err) {
    stripeRevenue = {
      activeCount: 0,
      totalMonthlyEur: 0,
      error: err instanceof Error ? err.message : "Stripe query failed",
    };
  }

  const [planCounts, msgs24h, msgs7d, errors24h, cost24h, modelBreakdown, totalUsers] =
    await Promise.all([
      // Users by plan
      db.select({ plan: users.plan, count: sql<number>`count(*)` })
        .from(users)
        .groupBy(users.plan),

      // Messages last 24h (assistant only — each = one reply)
      db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(eq(messages.role, "assistant"), gte(messages.createdAt, h24))),

      // Messages last 7d
      db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(eq(messages.role, "assistant"), gte(messages.createdAt, d7))),

      // Errors last 24h: assistant messages with empty content or the error sentinel
      db.select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(
          eq(messages.role, "assistant"),
          gte(messages.createdAt, h24),
          sql`(${messages.content} = '' OR ${messages.content} = '[Error generating response]')`,
        )),

      // Cost last 24h (in cents)
      db.select({ total: sql<number>`coalesce(sum(${messages.costCents}), 0)` })
        .from(messages)
        .where(gte(messages.createdAt, h24)),

      // Model breakdown last 7d
      db.select({ model: conversations.model, count: sql<number>`count(distinct ${conversations.id})` })
        .from(conversations)
        .where(gte(conversations.createdAt, d7))
        .groupBy(conversations.model),

      // Total users
      db.select({ count: sql<number>`count(*)` }).from(users),
    ]);

  const total = Number(totalUsers[0]?.count ?? 0);
  const msgs24hN = Number(msgs24h[0]?.count ?? 0);
  const errors24hN = Number(errors24h[0]?.count ?? 0);
  const errorRate24h = msgs24hN > 0 ? Math.round((errors24hN / msgs24hN) * 1000) / 10 : 0;

  const byPlan: Record<string, number> = {};
  for (const row of planCounts) {
    byPlan[row.plan ?? "unknown"] = Number(row.count);
  }

  const revenue = {
    stripe: stripeRevenue,
    db: {
      premiumCount: byPlan["premium"] ?? 0,
      proCount: byPlan["pro"] ?? 0,
      estimatedMonthlyEur: (byPlan["premium"] ?? 0) * 14.99 + (byPlan["pro"] ?? 0) * 29.99,
    },
  };

  res.json({
    users: { total, byPlan },
    messages: {
      last24h: msgs24hN,
      last7d:  Number(msgs7d[0]?.count ?? 0),
    },
    errors: {
      last24h: errors24hN,
      rate24hPct: errorRate24h,
    },
    cost: {
      last24hCents: Number(cost24h[0]?.total ?? 0),
      last24hEur: Math.round(Number(cost24h[0]?.total ?? 0)) / 100,
    },
    models: modelBreakdown.map(r => ({ model: r.model, conversations: Number(r.count) })),
    revenue,
    generatedAt: new Date().toISOString(),
  });
});

export default router;
