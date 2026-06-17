---
name: Clerk proxy JWT issuer alignment
description: Why clerkMiddleware must have proxyUrl set to match the JWT iss claim in proxy deployments
---

## Rule
In production, `clerkMiddleware` MUST include `proxyUrl` matching the
proxy path (`https://{host}/api/__clerk`). Without it, Bearer token
verification fails with 401 even when cookies work.

**Why:** When the Clerk proxy middleware sends `Clerk-Proxy-Url` to
Clerk FAPI, Clerk issues JWTs with `iss = proxy URL`. The `clerkMiddleware`
without `proxyUrl` expects `iss = Clerk FAPI URL` → strict JWT verification
fails for all JavaScript fetch requests. Browser navigation uses the
handshake flow (lenient) so it masks the bug.

**How to apply:**
```typescript
clerkMiddleware((req) => {
  const host = getClerkProxyHost(req);
  const isProd = process.env.NODE_ENV === "production";
  return {
    publishableKey: publishableKeyFromHost(host ?? "", process.env.CLERK_PUBLISHABLE_KEY),
    ...(isProd && host ? { proxyUrl: `https://${host}/api/__clerk` } : {}),
  };
})
```

Also: set `setAuthTokenGetter(() => getToken())` in the React app via a
component inside ClerkProvider so all customFetch calls include Bearer
tokens. This makes auth reliable even if cookies behave oddly.
