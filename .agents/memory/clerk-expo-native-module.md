---
name: Clerk Expo v3 + Expo Go NativeClerkModule fix
description: @clerk/expo v3.x crashes Expo Go because it requires a TurboModule 'ClerkExpo' at the top level of its compiled bundle, before any try/catch can run.
---

## The Rule
`@clerk/expo` ≥ v3 ships a top-level `require("../specs/NativeClerkModule")` in its compiled dist. In Expo Go (not a dev build), this TurboModule does not exist → the entire module fails to initialize → every screen that imports from `@clerk/expo` shows "missing default export".

## Why
The TurboModule spec is imported at the module-evaluation level, not inside a function. The try/catch in `loadNativeModule()` never gets a chance to run because the crash happens before function bodies execute.

## How to Apply
Mock the native module via Metro resolver in `metro.config.js`:

```js
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith("NativeClerkModule") || moduleName.endsWith("specs/NativeClerkModule")) {
    return { type: "sourceFile", filePath: path.resolve(__dirname, "mocks/NativeClerkModule.js") };
  }
  return context.resolveRequest(context, moduleName, platform);
};
```

Create `mocks/NativeClerkModule.js`:
```js
module.exports = null;
module.exports.default = null;
```

Also install `expo-secure-store@~15.0.8` (correct version for Expo 54) as a direct dep of the mobile package. The workspace-root install gets the wrong version (56.x).

This makes the native module gracefully return null, and @clerk/expo falls back to its JS-only auth path — email/password login works fine in Expo Go. OAuth/SSO features still require a dev build.
