---
name: Expo 54 + pnpm Metro bundle fix
description: Deployment build 404 on bundle download — root cause and fix for Expo 54 in a pnpm monorepo
---

## The rule
In Expo 54 with a pnpm monorepo, Metro's **effective root becomes the workspace root** (Expo CLI walks up the directory tree and detects the monorepo via `pnpm-workspace.yaml`). Two things must be correct for the build to succeed:

1. **`metro.config.js`**: `watchFolders` must include the entire `workspaceRoot` (not just specific lib folders). Without this, Metro cannot follow pnpm symlinks to the `.pnpm` virtual store and returns HTTP 404 on bundle requests.

2. **`build.js` bundle URL**: Must use `path.relative(workspaceRoot, entryPath)` — i.e. `artifacts/sgi-mobile/node_modules/expo-router/entry` — which is relative to the workspace root (Metro's effective root). Using `path.relative(projectRoot, entryPath)` gives `node_modules/expo-router/entry` which Metro cannot resolve because `expo-router` doesn't exist at the workspace root's `node_modules`.

**Why:**
- `artifacts/sgi-mobile/node_modules/expo-router` is a pnpm symlink → `../../../node_modules/.pnpm/expo-router@.../node_modules/expo-router`
- Metro follows the symlink to the real path in the `.pnpm` store
- Without `workspaceRoot` in watchFolders, Metro refuses to serve files from the `.pnpm` store (outside its watched roots)
- Metro's effective root is the workspace root (not `artifacts/sgi-mobile`), so bundle URLs must be relative to the workspace root

**How to apply:**
- Any time the mobile build fails with HTTP 404 on the bundle URL in deployment logs, check these two files: `metro.config.js` (watchFolders) and `scripts/build.js` (bundle URL path.relative argument).
- Diagnostic: if the bundle request times out (instead of immediate 404), the watchFolders fix is working and Metro is compiling.
