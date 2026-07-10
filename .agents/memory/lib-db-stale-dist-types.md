---
name: lib/db stale dist types
description: Downstream tsc can see a stale @workspace/db shape after a schema edit, because dist/*.d.ts is committed and consumed via TS project references.
---

`artifacts/*/tsconfig.json` uses `"references": [{ "path": "../../lib/db" }, ...]`. TypeScript project references resolve the referenced package's types from its **build output** (`lib/db/dist/*.d.ts`), not its `src/*.ts`, even though `package.json` `exports` point at `src/index.ts` for runtime (Node/esbuild) resolution.

**Why:** this caused a real bug — adding a column to `threads` in `lib/db/src/schema/threads.ts` did not surface in `db.insert(threads).values({...})` or `SELECT` result types in api-server, because `lib/db/dist/schema/threads.d.ts` still reflected the pre-edit shape. Deleting `.tsbuildinfo` caches alone did NOT fix it — the dist declaration files themselves were stale.

**How to apply:** after editing any file under `lib/db/src/schema/`, run `npx tsc --build --force` inside `lib/db` to regenerate `lib/db/dist/**/*.d.ts` before trusting downstream `tsc --noEmit` results in api-server/sgi-app/sgi-mobile. Runtime behavior (Node/esbuild) is unaffected since it resolves `src/` directly — only type-checking is at risk.
