'use strict';

const { requireNativeModule } = require('expo-modules-core');

let Native = null;
try {
  Native = requireNativeModule('SppFileImport');
} catch {
  Native = null;
}

/**
 * Opens Android app chooser (WhatsApp preferred first) via ACTION_GET_CONTENT.
 * Falls back to null when native module is unavailable.
 */
async function pickFromApps(options = {}) {
  if (!Native?.pickFromApps) return null;
  return Native.pickFromApps({
    multiple: !!options.multiple,
    mimeType: options.mimeType || '*/*',
    title: options.title || 'Import file',
  });
}

/**
 * Opens DocumentsUI starting at phone storage (not Downloads).
 */
async function pickFromStorage(options = {}) {
  if (!Native?.pickFromStorage) return null;
  return Native.pickFromStorage({
    multiple: !!options.multiple,
    mimeType: options.mimeType || '*/*',
  });
}

module.exports = {
  pickFromApps,
  pickFromStorage,
  isAvailable: () => !!Native,
};
