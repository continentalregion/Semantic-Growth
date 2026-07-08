---
name: Neon pool crash pattern
description: How to prevent Neon's compute autosuspend from crashing the Node.js process via unhandled pg-pool 'error' events (code 57P01).
---

# Neon compute autosuspend + pg-pool crash pattern

## The rule
Two defences are required together; neither alone is sufficient.

1. `idleTimeoutMillis: 60_000` — evict pool connections after 60s of idle
2. `process.on('uncaughtException', ...)` in `artifacts/api-server/src/index.ts` — intercept 57P01 at process level

## Why

### Neon autosuspend (this project)
Neon terminates all direct-connection idle connections when compute autosuspends.
The documented default is 300s, but **this project's actual observed threshold is ~120s**
(measured from production log timestamps). `idleTimeoutMillis` must be < actual threshold.

### Why `pool.on('error', ...)` alone is insufficient
pg-pool v3 has two code paths in `idleListener`:
- **Path A** (client still in `pool._idle`): removes client, calls `pool.emit('error', err, client)` → handler catches it ✓
- **Path B** (client already removed from `pool._idle`, e.g. when Neon terminates all 5 connections simultaneously): calls `pool.log(...)` — does NOT emit on pool → error propagates as unhandled → Node.js `throw er` → process crash ✗

When Neon terminates all 5 idle connections at once, only the FIRST one takes path A; the remaining four may take path B after pool._idle has already been mutated.

### Why `idleTimeoutMillis: 60s` alone is insufficient
If a 57P01 arrives anyway (e.g. due to a race at exactly the eviction boundary, or during startup before connections are released back to pool), the process would still crash without the safety net.

## How to apply

In `lib/db/src/index.ts`:
```ts
idleTimeoutMillis: 60 * 1000,   // 60s — below Neon's ~120s autosuspend
pool.on('error', (err) => { console.error('[db-pool] idle client error:', err.message); });
```

In `artifacts/api-server/src/index.ts` (before any imports take effect):
```ts
process.on("uncaughtException", (err: any) => {
  if (err?.code === "57P01") {
    console.error("[db-pool] 57P01 — pool will reconnect on next query:", err.message);
    return;  // let process continue; pg-pool already cleaned up the dead client
  }
  console.error("[fatal] uncaught exception:", err);
  process.exit(1);
});
```

**Why:** `process.on` must be registered before any async events can fire. esbuild hoists `import` statements, so `process.on` executes after all module initialization — this is fine because 57P01 events are always async (they come over the network socket).
