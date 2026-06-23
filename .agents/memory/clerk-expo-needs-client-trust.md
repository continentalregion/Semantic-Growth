---
name: Clerk Expo needs_client_trust fix
description: Why signIn.create() returns needs_client_trust in Expo Go and how the NativeClerkModule mock must be fixed
---

## The rule
`getClientToken()` in the NativeClerkModule mock MUST return a non-null value after `configure()` has been called. Returning `null` causes `syncNativeClientToJs()` to exit early, which prevents the Clerk JS client from being initialised via FAPI, causing `signIn.create()` to always return `needs_client_trust`.

**Why:**
`nativeClientSync.js` (in @clerk/expo dist) has an early-exit guard:
```js
const nativeDeviceToken = await readNativeDeviceToken({ waitForToken: true });
if (!nativeDeviceToken && !nativeClientEvent) return;  // ← exits if null
```
If it exits here, `refreshJsClientFromServer(clerkInstance)` is never called.
`refreshJsClientFromServer` makes the real HTTP GET to FAPI `/v1/client` that initialises the Clerk JS client. Without this call the client is uninitialised and every `signIn.create()` / `signUp.create()` returns `{status: "needs_client_trust"}`.

**How to apply:**
- In `mocks/NativeClerkModule.js`: set a module-level flag `_configured = false`; `configure()` sets it to `true`; `getClientToken()` returns `"expo-go-js-only"` when `_configured`, else `null`.
- The placeholder value is not a real cryptographic device token — it only unblocks the early-exit guard. Actual trust is established by the subsequent `refreshJsClientFromServer()` → `client.fetch()` HTTP call.
- In `login.tsx`: also call `getClerkInstance().__internal_reloadInitialResources()` on mount (pre-warm) and retry once on `needs_client_trust` response from `signIn.create()`.
- `__internal_reloadInitialResources` is an internal API of `@clerk/clerk-js` — cast as `unknown` before accessing.
