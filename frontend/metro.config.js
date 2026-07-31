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

// Harden `@/` resolution for release bundling (CI Gradle + Hermes).
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (typeof moduleName === 'string' && moduleName.startsWith('@/')) {
    const abs = path.resolve(projectRoot, moduleName.slice(2));
    return context.resolveRequest(context, abs, platform);
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;
