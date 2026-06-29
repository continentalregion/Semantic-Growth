---
name: API server deploy build (dist is rebuilt, NOT committed)
description: How the api-server binary is produced for production — built on deploy via artifact.toml, dist is gitignored
---

## Rule
`artifacts/api-server/dist/` is **gitignored and NOT committed**. The production
deployment **rebuilds it on deploy**, so a source change in
`artifacts/api-server/src/**` takes effect on the next Publish/republish **without
committing dist**.

**Why:** `artifacts/api-server/.replit-artifact/artifact.toml` defines
`[services.production.build]` → `pnpm --filter @workspace/api-server run build`
(esbuild via `build.mjs`) and `[services.production.run]` →
`node --enable-source-maps artifacts/api-server/dist/index.mjs`. So deploy builds
fresh dist from source, then runs it. (Earlier this repo committed dist and prod ran
the stale committed binary — that is no longer true; the note was corrected after
confirming the artifact.toml build step + `.gitignore` entry `dist`.)

**How to apply:** edit source, verify with the esbuild build + workflow restart, then
Publish. Do NOT hand-commit dist.

## Related: the real build is esbuild, NOT tsc
The api-server compiles via `node build.mjs` (esbuild, type-stripping — no type
checking). Running `pnpm --filter @workspace/api-server run typecheck`
(`tsc -p tsconfig.json --noEmit`) is **RED pre-existing** — it reports errors in
unmodified files (e.g. `chat.ts` column/schema drift, `@workspace/db` "no exported
member" from unbuilt TS project references).

**Why:** these tsc errors are not produced by your changes and do not block the app;
esbuild ignores them.

**How to apply:** validate api-server changes with the esbuild build
(`pnpm --filter @workspace/api-server run build`) + workflow restart. To confirm your
files are clean, grep the typecheck output for your filenames; do not treat the
pre-existing red `tsc --noEmit` as your regression.
