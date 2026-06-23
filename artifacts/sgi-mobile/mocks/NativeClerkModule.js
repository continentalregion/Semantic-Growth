// No-op mock for @clerk/expo NativeClerkModule in Expo Go.
// isClerkExpoModule() checks configure, getClientToken, syncClientStateFromJs.
// All methods resolve cleanly so Clerk initialises via JS/HTTP without native errors.
const mock = {
  configure: () => Promise.resolve(),
  getClientToken: () => Promise.resolve(null),
  syncClientStateFromJs: () => Promise.resolve(),
  addListener: (_eventName, _listener) => ({ remove: () => {} }),
};

module.exports = { default: mock };
