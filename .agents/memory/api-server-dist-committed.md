---
name: API server dist committed to git
description: The api-server dist/ directory is committed to git — production runs the committed binary, not a fresh build
---

## Rule
After ANY change to `artifacts/api-server/src/**`, you MUST run `pnpm run build` inside `artifacts/api-server/` and commit the updated `dist/index.mjs` before deploying. Otherwise production runs stale code.

**Why:** Replit's autoscale deployment does NOT rebuild the API server binary during deploy — it uses the committed `dist/` files directly. The dev workflow uses `pnpm run dev` which builds first, but that only affects the dev environment.

**How to apply:**
1. Edit source files in `artifacts/api-server/src/`
2. Run `cd artifacts/api-server && pnpm run build`
3. Commit the updated `dist/index.mjs` (and map files)
4. THEN click Publish

This was discovered after 3 failed deploys where the production API server kept returning 404 for a newly added route and 401 for all auth-protected routes — all because the committed binary predated the code changes.
