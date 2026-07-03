---
name: runTest requires testClerkAuth flag
description: Clerk-authenticated apps need testClerkAuth:true passed to runTest(), not just [Clerk Auth] steps in the plan
---

Writing `[Clerk Auth] Sign in as {...}` steps in a `runTest()` test plan is not enough for a Clerk-protected app — the `runTest` call itself must also pass `testClerkAuth: true`. Without it, the testing subagent falls back to the real Clerk sign-up/sign-in UI, which fails immediately because it has no password for the newly created account.

**Why:** Observed directly — the first test run with `[Clerk Auth]` steps but no `testClerkAuth` flag returned `status: "unable"` with the agent reporting it couldn't find a password. Re-running with `testClerkAuth: true` succeeded end-to-end.

**How to apply:** Any time a test plan includes a `[Clerk Auth]` step, also set `testClerkAuth: true` in the `runTest()` call parameters.
