import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { seedDemoData } from "./lib/demoSeed";
import { getStripeSync } from "./lib/stripeClient";
import { cleanupForeignModeStripeData } from "./lib/cleanupStripeData";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdminPlans() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmail) {
    logger.info("[seed] ADMIN_EMAIL not set — skipping admin plan seeding");
    return;
  }
  const ADMIN_EMAILS: { email: string; plan: "pro" | "premium" }[] = [
    { email: adminEmail, plan: "pro" },
  ];
  for (const { email, plan } of ADMIN_EMAILS) {
    try {
      const result = await db
        .update(users)
        .set({ plan })
        .where(eq(users.email, email))
        .returning({ id: users.id, email: users.email, plan: users.plan });
      if (result.length > 0) {
        logger.info({ email, plan }, "[seed] admin plan set");
      }
    } catch (err) {
      logger.error({ err, email }, "[seed] failed to set admin plan");
    }
  }
}

// Initialize Stripe: create/verify the synced `stripe` schema, register the
// managed webhook, and kick off a backfill. Non-blocking and fully guarded —
// a Stripe outage must never prevent the core API from serving requests.
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("[stripe] DATABASE_URL missing — skipping Stripe initialization");
    return;
  }
  try {
    logger.info("[stripe] running migrations…");
    // Creates/verifies the `stripe` schema (the schema name is fixed by the lib).
    await runMigrations({ databaseUrl });
    logger.info("[stripe] schema ready");

    // Remove leftover rows from the other Stripe mode (e.g. test-mode data
    // synced while production briefly ran on test keys) BEFORE the backfill —
    // stale customers otherwise break per-customer sync steps with
    // "No such customer". Idempotent and self-guarded.
    await cleanupForeignModeStripeData();

    const stripeSync = await getStripeSync();
    // PUBLIC_WEBHOOK_DOMAIN must be set explicitly in production secrets to the
    // real public domain (e.g. sgindex.work). REPLIT_DOMAINS is NOT guaranteed
    // to resolve to that domain — it can be an internal/preview Replit domain,
    // which would register the Stripe webhook against the wrong host. Fall
    // back to REPLIT_DOMAINS only when PUBLIC_WEBHOOK_DOMAIN is unset (dev/preview).
    const explicitDomain = process.env.PUBLIC_WEBHOOK_DOMAIN?.trim();
    const domain = explicitDomain || process.env.REPLIT_DOMAINS?.split(",")[0];
    const domainSource = explicitDomain ? "PUBLIC_WEBHOOK_DOMAIN" : "REPLIT_DOMAINS";
    if (domain) {
      logger.info({ domain, source: domainSource }, "[stripe] registering managed webhook using domain");
      const webhook = await stripeSync.findOrCreateManagedWebhook(
        `https://${domain}/api/stripe/webhook`,
      );
      logger.info({ url: webhook?.url ?? "ok" }, "[stripe] managed webhook ready");
    } else {
      logger.warn("[stripe] no domain available (PUBLIC_WEBHOOK_DOMAIN and REPLIT_DOMAINS both missing) — skipping managed webhook setup");
    }

    stripeSync
      .syncBackfill({ object: "all" })
      .then((res) => logger.info({ res }, "[stripe] data backfill complete"))
      .catch((err) => logger.error({ err }, "[stripe] data backfill failed"));
  } catch (err) {
    logger.error({ err }, "[stripe] initialization failed — billing may be degraded");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  seedAdminPlans();
  seedDemoData();
  // Fire-and-forget: never blocks startup, never crashes the process.
  void initStripe();
});
