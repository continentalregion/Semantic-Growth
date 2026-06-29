import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

/**
 * Fetches Stripe credentials from the Replit connection API.
 * Not cached -- tokens can rotate, so fetch fresh each time.
 */
async function getStripeCredentials(): Promise<{ secretKey: string; webhookSecret?: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit environment variables. " +
        "Ensure the Stripe integration is connected via the Integrations tab.",
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);
  }

  const data = (await resp.json()) as {
    items?: Array<{
      environment?: string;
      settings?: { secret?: string; webhook_secret?: string };
    }>;
  };

  // The credential proxy returns ALL connections for the account (both the
  // development/test and production/live Stripe connections) in `items`.
  // We MUST select the one matching the current runtime environment instead of
  // blindly taking items[0] -- otherwise the deployed (production) app would
  // pick up the test connection and run checkout in Sandbox mode.
  // REPL_IDENTITY is present only in the workspace (development); deployments
  // authenticate with WEB_REPL_RENEWAL, so its absence means production.
  const targetEnv = process.env.REPL_IDENTITY ? "development" : "production";
  const items = data.items ?? [];
  const match =
    items.find((it) => it.environment === targetEnv) ??
    // Fail closed: only fall back to a lone item when the proxy returned no
    // `environment` field at all (legacy shape). NEVER fall back to a
    // mismatched-environment connection -- that is exactly how production ends
    // up silently using the test connection.
    (items.length === 1 && !items[0].environment ? items[0] : undefined);
  const settings = match?.settings;

  if (!settings?.secret) {
    throw new Error(
      `Stripe integration not connected for the "${targetEnv}" environment, ` +
        "or missing secret key. Connect Stripe (live keys for production) via " +
        "the Integrations / Deploy pane first.",
    );
  }

  // Mode is encoded in the key itself (`_test_` / `_live_`). Fail closed so we
  // never run live checkout with a test key (Sandbox on the live domain), nor
  // use a live key in development (real charges while testing). Never log keys.
  const secretKey = settings.secret;
  if (targetEnv === "production" && secretKey.includes("_test_")) {
    throw new Error(
      "Refusing to start: production resolved a TEST Stripe key. Connect the " +
        "production (live) Stripe connection in the Deploy / Integrations pane.",
    );
  }
  if (targetEnv === "development" && secretKey.includes("_live_")) {
    throw new Error(
      "Refusing to start: development resolved a LIVE Stripe key. Use the test " +
        "Stripe connection in development to avoid real charges.",
    );
  }

  return {
    secretKey,
    webhookSecret: settings.webhook_secret,
  };
}

/**
 * Returns a fresh authenticated Stripe client.
 * Not cached -- fetches credentials on every call so rotated keys are picked up.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

/**
 * Returns a fresh StripeSync instance for webhook processing and data sync.
 * Not cached -- fetches credentials on every call so rotated keys are picked up.
 */
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? "",
  });
}

/**
 * Whether the active Stripe credentials are LIVE keys. Mode is encoded in the
 * key itself (`_live_` / `_test_`), so this needs no API round-trip.
 */
export async function isStripeLiveMode(): Promise<boolean> {
  const { secretKey } = await getStripeCredentials();
  return secretKey.includes("_live_");
}
