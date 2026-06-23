// Mock for @clerk/expo NativeClerkModule in Expo Go.
//
// Root cause of "needs_client_trust" in Expo Go:
//   nativeClientSync.js calls readNativeDeviceToken() which polls getClientToken().
//   If getClientToken() returns null, syncNativeClientToJs() exits early (guard at
//   "if (!nativeDeviceToken && !nativeClientEvent) return;") and
//   refreshJsClientFromServer() is never called → Clerk JS client never initialised
//   from FAPI → signIn.create() returns needs_client_trust.
//
// Fix: configure() sets a non-null placeholder so getClientToken() returns
// something truthy, allowing the sync to proceed and call
// refreshJsClientFromServer() which makes the real GET /v1/client FAPI call
// and initialises the JS client properly.
//
// The placeholder is not a real cryptographic device token; it is only used to
// unblock the early-exit guard in nativeClientSync.js. The actual trust is
// established by the subsequent refreshJsClientFromServer() → client.fetch() call.

let _configured = false;

const mock = {
  // Called with (publishableKey, cachedDeviceToken|null).
  // First invocation: arm getClientToken() to return non-null.
  configure: (_publishableKey, _deviceToken) => {
    _configured = true;
    return Promise.resolve();
  },

  // Must return non-null AFTER configure() has been called so that
  // syncNativeClientToJs() does NOT exit early and calls
  // refreshJsClientFromServer() → real FAPI /v1/client HTTP call.
  getClientToken: () => Promise.resolve(_configured ? "expo-go-js-only" : null),

  // No-op: native Clerk UI components don't exist in Expo Go.
  syncClientStateFromJs: () => Promise.resolve(),

  // No-op: no native events to receive.
  addListener: (_eventName, _listener) => ({ remove: () => {} }),
};

module.exports = { default: mock };
