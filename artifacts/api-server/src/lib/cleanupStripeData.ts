import { db, users } from "@workspace/db";
import { inArray, sql } from "drizzle-orm";
import { logger } from "./logger";
import { isStripeLiveMode } from "./stripeClient";

/**
 * Purge synced Stripe rows that belong to the *other* mode from the `stripe`
 * schema.
 *
 * When production briefly ran on test keys, test-mode objects were backfilled
 * into the live database. After switching to live keys those leftover rows break
 * sync steps that iterate the local table and then call Stripe per row
 * (e.g. `syncPaymentMethods` → "No such customer"). We delete every row whose
 * `livemode` does not match the active key mode.
 *
 * - Idempotent: after the first run there are no foreign-mode rows left, so
 *   subsequent runs delete nothing.
 * - Safe: the synced `stripe` tables declare no foreign keys between each other,
 *   so deletes never cascade or violate constraints.
 * - Must run AFTER the schema migration and BEFORE the backfill.
 */
export async function cleanupForeignModeStripeData(): Promise<void> {
  let live: boolean;
  try {
    live = await isStripeLiveMode();
  } catch (err) {
    logger.warn({ err }, "[stripe] cleanup skipped — could not resolve key mode");
    return;
  }

  // Rows whose livemode is the opposite of the active key are stale leftovers.
  const staleLivemode = !live;

  try {
    // Customers first, capturing the ids we remove so we can detach any user
    // records still pointing at them (their checkout would otherwise fail).
    const removed = await db.execute(
      sql`DELETE FROM stripe.customers WHERE livemode = ${staleLivemode} RETURNING id`,
    );
    const removedIds = (removed.rows as Array<{ id?: unknown }>)
      .map((r) => r.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (removedIds.length > 0) {
      await db
        .update(users)
        .set({ stripeCustomerId: null })
        .where(inArray(users.stripeCustomerId, removedIds));
      logger.info(
        { count: removedIds.length },
        "[stripe] cleanup: removed foreign-mode customers and detached user refs",
      );
    }

    // Every other synced table that carries a `livemode` flag.
    const tables = await db.execute(sql`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'stripe'
        AND column_name = 'livemode'
        AND table_name <> 'customers'
      ORDER BY table_name
    `);

    let otherRows = 0;
    for (const row of tables.rows as Array<{ table_name?: unknown }>) {
      const table = row.table_name;
      if (typeof table !== "string" || table.length === 0) continue;
      const del = await db.execute(
        sql`DELETE FROM stripe.${sql.identifier(table)} WHERE livemode = ${staleLivemode}`,
      );
      otherRows += del.rowCount ?? 0;
    }
    if (otherRows > 0) {
      logger.info(
        { count: otherRows },
        "[stripe] cleanup: removed foreign-mode rows from synced tables",
      );
    }
  } catch (err) {
    logger.error({ err }, "[stripe] foreign-mode cleanup failed — backfill may be degraded");
  }
}
