---
name: Expo workflow port fix for Replit
description: Expo mobile workflow fails with DIDNT_OPEN_A_PORT despite Metro running — fixed by registering the port in .replit [[ports]]
---

## The Rule

Every port used by an Expo artifact's Metro bundler MUST be declared in `.replit` [[ports]] for the Replit workflow system to detect it. Without this entry, the workflow health check fails with "DIDNT_OPEN_A_PORT" even though Metro starts and announces the port correctly.

**Why:** The Replit workflow system's port monitor only watches ports listed in `.replit` [[ports]]. Metro starts correctly (logs show "Web is waiting on http://localhost:18175"), but the monitor never sees it because the port is unregistered.

**How to apply:** When creating or updating an Expo artifact with localPort X, also add:
```toml
[[ports]]
localPort = X
externalPort = <unused external port>
```
to `.replit` using `verifyAndReplaceDotReplit`. Use `configureWorkflow` or similar if available. The Expo artifact for SGI Mobile uses localPort 18175 / externalPort 3001.

## Secondary findings (same debugging session)

- `useSignIn()` / `useSignUp()` in @clerk/expo v3 (re-exported from @clerk/react v6 with React 19 signals) return `SignInSignalValue` / `SignUpSignalValue` — destructuring `setActive` and `isLoaded` fails TypeScript. Fix: get `setActive` from `useClerk()`, `isLoaded` from `useAuth()`, and cast the hook returns to explicit inline types.
- `metro.config.js` `enhanceMiddleware` is NOT needed and causes confusion — remove it to keep Metro config simple.
- `--localhost` flag in `expo start` does NOT prevent the workflow port check from working once the port is in `.replit`. Removed it to bind Metro to all interfaces anyway.
