---
name: Stripe test→live key migration leaves poisoned data
description: After a Replit Stripe deployment switches from test to live keys, leftover test-mode rows and stale stripeCustomerId break checkout + backfill; the self-healing fix pattern.
---

# Stripe test→live key switch poisons the live environment

**Symptom:** A deployment that briefly ran on TEST Stripe keys, then switched to
LIVE, fails checkout with `No such customer: 'cus_...'` (at
`checkout.sessions.create`) and the sync `[stripe] data backfill failed` with the
same id during `syncPaymentMethods`. The price/product IDs are NOT the cause —
the live catalog is fine; the stored customer id is a test-only id that does not
exist in live.

**Why:** Two stale data sources survive the key switch:
1. `users.stripeCustomerId` holds a customer created under the old (test) key.
   `ensureStripeCustomer` returned it without checking it exists in the current
   env.
2. The synced `stripe.*` tables hold test-mode rows. `syncPaymentMethods` must
   list payment methods *per customer* (Stripe has no global list), so it
   iterates the local `stripe.customers` rows and 404s on the test customer.

**Fix pattern (both needed):**
- *Self-heal lazily:* before reusing `user.stripeCustomerId`, call
  `stripe.customers.retrieve()`; on `resource_missing` (err.code) or a deleted
  customer, conditionally clear the id (only `WHERE stripe_customer_id = <that
  exact id>` to stay race-safe) and create a fresh one. Apply to checkout AND
  portal routes.
- *Purge eagerly at startup:* before the backfill, delete rows from every
  synced `stripe.*` table where `livemode <> active-key-mode`, and NULL any
  `users.stripe_customer_id` referencing a removed customer.

**How to apply / key facts:**
- Active key mode is encoded in the secret string (`_live_` vs `_test_`) — no API
  call needed.
- The synced `stripe.*` tables declare **no foreign keys between each other**, so
  deleting rows never cascades or violates constraints. `stripe.customers` (and
  most stripe tables) have a `livemode` column; a few detail tables
  (payment_methods, setup_intents, subscription_items, refunds,
  checkout_session_line_items) do not — that's fine, the per-customer iteration
  only reads `stripe.customers`.
- The cleanup MUST run as app code (the app's own drizzle connection). The
  `executeSql` tool **blocks all `stripe.*` mutations**, and the production DB is
  **read-only** from the workspace — so you cannot clean prod data from the
  agent; it has to self-heal on boot. Dev and prod are **separate databases**.
- The purge is symmetric/idempotent: in dev (test key) it deletes `livemode=true`
  rows (preserving test data); in prod (live key) it deletes `livemode=false`.
