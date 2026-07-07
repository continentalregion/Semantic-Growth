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
  // Keep connections alive for 30 minutes so the pool stays warm between
  // normal usage gaps. The default (10s) causes pool-wide reconnection storms
  // when the first burst of concurrent requests arrives after any idle period,
  // adding 1–3.5s latency to every "cold" DB hit.
  idleTimeoutMillis: 30 * 60 * 1000,
  max: 5,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
