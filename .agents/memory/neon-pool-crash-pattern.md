---
name: Neon pool crash pattern
description: How to prevent Neon's compute autosuspend from crashing the Node.js process via unhandled pg-pool 'error' events (code 57P01).
---

# Neon compute autosuspend + pg-pool crash pattern

## The rule
Two things are required together in `lib/db/src/index.ts`:

1. `idleTimeoutMillis: 60_000` — evict pool connections after 60s of idle
2. `pool.on('error', (err) => { console.error(...) })` — handle pg-pool 'error' events so Node.js does not treat them as unhandled exceptions

`pool.on('error', ...)` (line 30 of `lib/db/src/index.ts`) is a **targeted listener on the specific pool EventEmitter** — it only handles errors emitted by pg-pool when an idle DB client disconnects unexpectedly. This is the correct, scoped fix for this problem.

There is also a `process.on('uncaughtException', ...)` guard in `artifacts/api-server/src/index.ts` that handles 57P01 as a process-level backstop, but that is a **separate, broader mechanism** (it would intercept any unhandled exception in the entire process). It is not the same as the pool handler and should not be confused with it.

## Why

### Neon autosuspend (this project)
Neon terminates all direct-connection idle connections when compute autosuspends.
The documented default is 300s, but **this project's actual observed threshold is ~120s**
(measured from production log timestamps). `idleTimeoutMillis` must be < actual threshold.

### Why `pool.on('error', ...)` is necessary
When Neon sends FATAL (pg code `57P01`) to an idle pool client, pg-pool emits an `'error'`
event on the Pool instance. Without a listener, Node.js's EventEmitter re-throws that error
as an uncaught exception and kills the process — even though pg-pool has already cleaned up
the dead client internally. The handler only needs to log and return; no manual cleanup needed.

### Why `idleTimeoutMillis: 60s` is also necessary
With a TTL longer than Neon's autosuspend (~120s observed), the pool holds connections Neon
has already terminated — causing a continuous crash loop on every autosuspend cycle. Setting
the TTL to 60s means the pool evicts connections before Neon terminates them, eliminating the
race condition entirely.

## How to apply (lib/db/src/index.ts)

```ts
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 60 * 1000,   // 60s — below Neon's ~120s autosuspend on this project
  max: 5,
});

// Handle pg-pool 'error' event emitted when an idle client is terminated by Neon
// (pg code 57P01: "terminating connection due to administrator command").
// Without this listener, Node.js treats the unhandled EventEmitter error as an
// uncaught exception and kills the process. pg-pool removes the dead client
// from the pool automatically; this handler only needs to log and return.
pool.on('error', (err) => {
  console.error('[db-pool] idle client error (connection removed from pool):', err.message);
});
```
