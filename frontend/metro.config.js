// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(projectRoot, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Explicit `@/` → project root (matches tsconfig paths).
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  let target = moduleName;
  if (typeof moduleName === 'string' && moduleName.startsWith('@/')) {
    target = path.resolve(projectRoot, moduleName.slice(2));
  }

  if (typeof upstreamResolveRequest === 'function') {
    return upstreamResolveRequest(context, target, platform);
  }

  // Metro default resolver (do not call context.resolveRequest — that is us).
  return require('metro-resolver').resolve(context, target, platform);
};

config.maxWorkers = 2;

module.exports = config;
