'use strict';

const { requireOptionalNativeModule } = require('expo-modules-core');

function getNative() {
  try {
    return requireOptionalNativeModule('SppFileImport');
  } catch {
    return null;
  }
}

function isAvailable() {
  const n = getNative();
  if (!n) return false;
  try {
    // Prefer explicit readiness check when present.
    if (typeof n.isNativeReady === 'function') return !!n.isNativeReady();
    return typeof n.pickFromApps === 'function';
  } catch {
    return false;
  }
}

async function openWhatsApp() {
  const Native = getNative();
  if (!Native?.openWhatsApp) {
    throw new Error('SppFileImport native module is not available');
  }
  return Native.openWhatsApp();
}

async function pickFromApps(options = {}) {
  const Native = getNative();
  if (!Native?.pickFromApps) {
    throw new Error('SppFileImport native module is not available');
  }
  return Native.pickFromApps(
    !!options.multiple,
    options.mimeType || '*/*',
    options.title || 'Import file',
  );
}

async function pickFromStorage(options = {}) {
  const Native = getNative();
  if (!Native?.pickFromStorage) {
    throw new Error('SppFileImport native module is not available');
  }
  return Native.pickFromStorage(
    !!options.multiple,
    options.mimeType || '*/*',
  );
}

async function takePendingShare() {
  const Native = getNative();
  if (!Native?.takePendingShare) return null;
  return Native.takePendingShare();
}

module.exports = {
  openWhatsApp,
  pickFromApps,
  pickFromStorage,
  takePendingShare,
  isAvailable,
};
