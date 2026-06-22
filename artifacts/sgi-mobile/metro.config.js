const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// In a pnpm monorepo, expo-router (and other packages) are symlinked from
// node_modules/ to the pnpm virtual store at workspaceRoot/node_modules/.pnpm/.
// Metro must watch the entire workspace root so it can resolve and serve files
// from the pnpm store when following those symlinks.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
