---
name: Stripe Replit-managed connector + stripe-replit-sync quirks
description: Two non-obvious gotchas when wiring the Replit-managed Stripe connector and the stripe-replit-sync library that cost real debugging time.
---

# Stripe connector / stripe-replit-sync quirks

## 1. Connector field name is `settings.secret`, NOT `settings.secret_key`
The live Replit-managed Stripe connector exposes the secret key at `settings.secret`
(plus `settings.publishable`). There is NO `settings.webhook_secret`. The code-template
in the skill used `settings.secret_key`, which is stale and silently yields `undefined`.
**Why:** building the Stripe client from `settings.secret_key` produced an unauthenticated
client; everything failed downstream.
**How to apply:** in any stripeClient builder read `settings.secret`. Webhook info (when
needed) is top-level `webhook_config` / `webhook_identifier`, not in `settings`.

## 2. `syncBackfill()` with no args syncs NOTHING — must pass `{ object: "all" }`
In stripe-replit-sync, `syncBackfill(params)` does
`const { object } = params ?? { object: this.getSupportedEventTypes }`. With no args,
`object` becomes a *function reference*, which matches no `case` in its internal switch,
so zero records sync (it still logs "data backfill complete").
**Why:** products/prices were created in Stripe but `stripe.products`/`stripe.prices`
tables stayed empty; the success log masked it.
**How to apply:** always call `syncBackfill({ object: "all" })`.

## Managed webhooks
We use `findOrCreateManagedWebhook(url)`; with managed webhooks the StripeSync lib
resolves the webhook signing secret from its own DB tables, so an empty constructor
`webhookSecret: ''` is fine. The webhook route must be mounted with `express.raw` BEFORE
`express.json()` and must bypass clerkMiddleware (server-to-server, raw Buffer body for
signature verification).

## Plan sync loop (SGI)
`reconcileStripePlanForUser` derives plan from active/trialing `stripe.subscriptions`
(via subscription_items → prices → `metadata.plan`, max rank) and is called inside
`getOrCreateUser`. Since `GET /users/me` calls `getOrCreateUser`, both upgrades and
cancellations surface on the next profile load — no extra webhook-side plan write needed.
