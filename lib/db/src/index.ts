import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 60s — evict pool connections after 1 minute of idle. Neon autosuspends its
  // compute at ~2min of inactivity on this project (observed in production logs,
  // shorter than the default 300s). Setting the pool TTL to 60s ensures the pool
  // evicts connections before Neon terminates them server-side, preventing the
  // FATAL "terminating connection due to administrator command" (pg code 57P01)
  // crash loop seen when idleTimeoutMillis exceeded Neon's actual autosuspend.
  idleTimeoutMillis: 60 * 1000,
  max: 5,
});

// Safety net: pg-pool emits 'error' when an idle client receives an unexpected
// error (e.g. Neon terminates the connection). Without this listener, Node.js
// treats the unhandled EventEmitter error as an uncaught exception and kills
// the process. pg-pool removes the dead client from the pool automatically;
// this handler only needs to log and return.
pool.on('error', (err) => {
  console.error('[db-pool] idle client error (connection removed from pool):', err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
