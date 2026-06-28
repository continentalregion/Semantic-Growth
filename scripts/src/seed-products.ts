import { getUncachableStripeClient } from "./stripeClient";

/**
 * Seeds the SGI subscription products and prices in Stripe.
 *
 * Idempotent: searches by product name and reuses an existing matching
 * recurring EUR price. Sets `metadata.plan` on BOTH the product and the price
 * so the backend can derive the plan tier from either.
 *
 * Run with: pnpm --filter @workspace/scripts run seed-products
 */
type PlanSeed = {
  plan: "premium" | "pro";
  name: string;
  description: string;
  unitAmount: number; // in cents (EUR)
};

const PLANS: PlanSeed[] = [
  {
    plan: "premium",
    name: "SGI Premium",
    description: "Mappa semantica interattiva, storico esteso e analisi avanzate.",
    unitAmount: 999,
  },
  {
    plan: "pro",
    name: "SGI Pro",
    description: "Tutto Premium piu predizioni, confronti illimitati e priorita.",
    unitAmount: 1999,
  },
];

async function seed() {
  const stripe = await getUncachableStripeClient();
  console.log("Seeding SGI products and prices in Stripe...");

  for (const p of PLANS) {
    const existing = await stripe.products.search({
      query: `name:'${p.name}' AND active:'true'`,
    });

    let product = existing.data[0];
    if (product) {
      console.log(`Product exists: ${p.name} (${product.id})`);
      if (product.metadata?.plan !== p.plan) {
        product = await stripe.products.update(product.id, {
          metadata: { ...product.metadata, plan: p.plan },
        });
        console.log(`  -> set product metadata.plan=${p.plan}`);
      }
    } else {
      product = await stripe.products.create({
        name: p.name,
        description: p.description,
        metadata: { plan: p.plan },
      });
      console.log(`Created product: ${p.name} (${product.id})`);
    }

    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
    const match = prices.data.find(
      (pr) =>
        pr.recurring?.interval === "month" &&
        pr.currency === "eur" &&
        pr.unit_amount === p.unitAmount,
    );

    if (match) {
      console.log(`  price exists: ${(p.unitAmount / 100).toFixed(2)} EUR/mo (${match.id})`);
      if (match.metadata?.plan !== p.plan) {
        await stripe.prices.update(match.id, {
          metadata: { ...match.metadata, plan: p.plan },
        });
        console.log(`  -> set price metadata.plan=${p.plan}`);
      }
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: p.unitAmount,
        currency: "eur",
        recurring: { interval: "month" },
        metadata: { plan: p.plan },
      });
      console.log(`  created price: ${(p.unitAmount / 100).toFixed(2)} EUR/mo (${price.id})`);
    }
  }

  console.log("\u2713 Seed complete. The Stripe webhook backfill will sync this into the DB.");
}

seed().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
