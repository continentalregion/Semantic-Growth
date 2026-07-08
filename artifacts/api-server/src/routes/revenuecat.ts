import { Router, type IRouter } from "express";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── RevenueCat product → SGI plan mapping ───────────────────────────────────
// These identifiers MUST match the product IDs created on App Store Connect
// and Google Play Console, and linked in the RevenueCat dashboard.
// Update these values once IAP products are live (Apple Developer Program
// approval required).
const PRODUCT_TO_PLAN: Record<string, "premium" | "pro"> = {
  "com.sgi.mobile.premium.monthly": "premium",
  "com.sgi.mobile.pro.monthly":     "pro",
};

// ─── RevenueCat event types that signal an active entitlement ─────────────────
const ACTIVE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "REACTIVATION",
  "UNCANCELLATION",
  "TRANSFER",
  "NON_SUBSCRIPTION_PURCHASE",
]);

// ─── RevenueCat event types that signal plan expiry / cancellation ─────────────
const EXPIRED_EVENTS = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "SUBSCRIBER_ALIAS",  // treated as no-op but listed for completeness
]);

/**
 * POST /webhooks/revenuecat
 *
 * Receives RevenueCat server-to-server notifications and updates the user's
 * plan in the database. Idempotent by design: setting plan = X when it is
 * already X is a no-op at the DB level.
 *
 * Auth: Authorization: Bearer <REVENUECAT_WEBHOOK_TOKEN>
 * Docs: https://www.revenuecat.com/docs/integrations/webhooks
 */
router.post("/webhooks/revenuecat", async (req, res) => {
  // ── 1. Verify bearer token ─────────────────────────────────────────────────
  const expectedToken = process.env.REVENUECAT_WEBHOOK_TOKEN;
  if (!expectedToken) {
    logger.warn("[revenuecat] REVENUECAT_WEBHOOK_TOKEN not configured — webhook disabled");
    res.status(503).json({ error: "Webhook not configured" });
    return;
  }

  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token !== expectedToken) {
    logger.warn({ authHeader: authHeader.slice(0, 20) }, "[revenuecat] unauthorized webhook attempt");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // ── 2. Parse event ─────────────────────────────────────────────────────────
  const body = req.body as {
    event?: {
      type?: string;
      app_user_id?: string;
      product_id?: string;
    };
  };

  const event = body?.event;
  const eventType   = event?.type ?? "";
  const appUserId   = event?.app_user_id ?? "";  // = clerkId set at Purchases.logIn()
  const productId   = event?.product_id ?? "";

  if (!appUserId) {
    logger.warn({ eventType }, "[revenuecat] webhook missing app_user_id — skipping");
    res.status(200).json({ ok: true, skipped: "missing app_user_id" });
    return;
  }

  try {
    if (ACTIVE_EVENTS.has(eventType)) {
      // ── 3a. Active purchase / renewal: upgrade or maintain plan ─────────────
      const plan = PRODUCT_TO_PLAN[productId];
      if (!plan) {
        logger.info({ eventType, productId }, "[revenuecat] unknown product_id — ignoring");
        res.status(200).json({ ok: true, skipped: "unknown product_id" });
        return;
      }

      await db
        .update(users)
        .set({ plan, planSource: "iap" })
        .where(eq(users.clerkId, appUserId));

      logger.info({ eventType, appUserId, productId, plan }, "[revenuecat] plan set via IAP");

    } else if (EXPIRED_EVENTS.has(eventType)) {
      // ── 3b. Cancellation / expiry: only downgrade if currently on IAP plan ──
      // Do NOT touch plan if planSource = "stripe" (Stripe manages its own
      // lifecycle via its own webhook flow).
      const [user] = await db
        .select({ id: users.id, plan: users.plan, planSource: users.planSource })
        .from(users)
        .where(eq(users.clerkId, appUserId))
        .limit(1);

      if (user && user.planSource === "iap") {
        await db
          .update(users)
          .set({ plan: "free", planSource: "iap" })
          .where(eq(users.clerkId, appUserId));
        logger.info({ eventType, appUserId }, "[revenuecat] IAP expired — plan set to free");
      } else {
        logger.info({ eventType, appUserId }, "[revenuecat] expiry ignored (planSource != iap)");
      }

    } else {
      logger.info({ eventType }, "[revenuecat] unhandled event type — no-op");
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err, eventType, appUserId }, "[revenuecat] webhook handler error");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
