import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { db, users } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getOrCreateUser } from "../lib/getOrCreateUser";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type PlanId = "premium" | "pro";
const VALID_PLANS: PlanId[] = ["premium", "pro"];

// Resolve a safe absolute base URL for Stripe redirects. A client-provided
// returnUrl is only honored when it points at the same host as the incoming
// request (prevents open-redirect abuse); otherwise we fall back to the host.
function safeReturnUrl(req: Request, returnUrl: unknown): string {
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] ?? req.protocol;
  const host =
    (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0] ?? req.get("host") ?? "";
  const fallback = `${proto}://${host}`;
  if (typeof returnUrl !== "string" || !returnUrl) return fallback;
  try {
    const parsed = new URL(returnUrl);
    if (parsed.host === host) return `${parsed.origin}${parsed.pathname}`;
  } catch {
    /* malformed returnUrl — ignore */
  }
  return fallback;
}

function withParam(url: string, key: string, value: string): string {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}

/** Ensure the user has a Stripe customer id, creating one if needed (race-safe). */
async function ensureStripeCustomer(userId: number): Promise<string | null> {
  const [current] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!current) return null;
  if (current.stripeCustomerId) return current.stripeCustomerId;

  const stripe = await getUncachableStripeClient();
  const isPlaceholderEmail = current.email.endsWith("@clerk.local");
  const customer = await stripe.customers.create({
    ...(isPlaceholderEmail ? {} : { email: current.email }),
    metadata: { userId: String(current.id), clerkId: current.clerkId },
  });

  // Only claim the slot if it is still empty (another request may have won).
  await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(and(eq(users.id, userId), isNull(users.stripeCustomerId)));

  const [reread] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const finalId = reread?.stripeCustomerId ?? customer.id;

  // Lost the race — clean up the duplicate Stripe customer we just created.
  if (finalId !== customer.id) {
    try {
      await stripe.customers.del(customer.id);
    } catch {
      /* best-effort cleanup */
    }
  }
  return finalId;
}

// GET /billing/plans — subscription catalog from the synced stripe schema.
router.get("/billing/plans", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(pr.metadata->>'plan', prod.metadata->>'plan') AS plan,
        prod.name AS name,
        pr.id AS price_id,
        pr.unit_amount AS unit_amount,
        pr.currency AS currency,
        pr.recurring AS recurring
      FROM stripe.prices pr
      JOIN stripe.products prod ON prod.id = pr.product
      WHERE pr.active = true AND prod.active = true
        AND pr.recurring IS NOT NULL
        AND COALESCE(pr.metadata->>'plan', prod.metadata->>'plan') IN ('premium', 'pro')
      ORDER BY pr.unit_amount ASC
    `);
    const plans = (result.rows as Array<Record<string, unknown>>).map((r) => ({
      plan: r.plan as string,
      name: r.name as string,
      priceId: r.price_id as string,
      unitAmount: Number(r.unit_amount),
      currency: r.currency as string,
      interval: (r.recurring as { interval?: string } | null)?.interval ?? "month",
    }));
    res.json(plans);
  } catch (err) {
    logger.error({ err }, "[billing] failed to list plans");
    res.status(500).json({ error: "Failed to list plans" });
  }
});

// POST /billing/checkout — create a Stripe Checkout session for the given plan.
router.post("/billing/checkout", async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const plan = req.body?.plan as string | undefined;
  if (!plan || !VALID_PLANS.includes(plan as PlanId)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  try {
    const user = await getOrCreateUser(auth.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const priceResult = await db.execute(sql`
      SELECT pr.id AS price_id
      FROM stripe.prices pr
      JOIN stripe.products prod ON prod.id = pr.product
      WHERE pr.active = true AND prod.active = true
        AND pr.recurring IS NOT NULL
        AND COALESCE(pr.metadata->>'plan', prod.metadata->>'plan') = ${plan}
      ORDER BY pr.unit_amount ASC
      LIMIT 1
    `);
    const priceId = (priceResult.rows[0] as { price_id?: string } | undefined)?.price_id;
    if (!priceId) {
      res.status(503).json({ error: "Plan not available" });
      return;
    }

    const customerId = await ensureStripeCustomer(user.id);
    if (!customerId) {
      res.status(500).json({ error: "Could not create billing customer" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const base = safeReturnUrl(req, req.body?.returnUrl);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: withParam(base, "checkout", "success"),
      cancel_url: withParam(base, "checkout", "cancel"),
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "[billing] checkout failed");
    res.status(500).json({ error: "Checkout failed" });
  }
});

// POST /billing/portal — open the Stripe billing portal for the current user.
router.post("/billing/portal", async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const user = await getOrCreateUser(auth.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!user.stripeCustomerId) {
      res.status(400).json({ error: "No billing account" });
      return;
    }
    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: safeReturnUrl(req, req.body?.returnUrl),
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "[billing] portal failed");
    res.status(500).json({ error: "Portal failed" });
  }
});

export default router;
