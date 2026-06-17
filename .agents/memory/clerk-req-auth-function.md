---
name: req.auth is a function in @clerk/express v2
description: In @clerk/express v2, req.auth is a branded function, not a plain object. Access userId via getAuth(req).userId, not req.auth?.userId.
---

## The Rule

In `@clerk/express` v2+, `req.auth` is a **branded function** (`(opts) => requestState.toAuth(opts)`), not a plain object. The function only has the Clerk brand symbol as a property.

```typescript
// WRONG — req.auth is a function; .userId is always undefined
const userId = req.auth?.userId;  // ← undefined every time

// CORRECT — call getAuth() which internally calls req.auth(options)
import { getAuth } from '@clerk/express';
const userId = getAuth(req).userId;
```

**Why:** `clerkMiddleware` does `Object.assign(request, { auth: brandRequestAuth(fn) })` where `brandRequestAuth = (fn) => Object.assign(fn, { [brand]: true })`. The function has no `.userId` property — you must call it via `getAuth(req)`.

**How to apply:** Any Express route handler that checks authentication must import `getAuth` from `@clerk/express` and use `getAuth(req).userId` instead of `req.auth?.userId`.
