'use strict';

const { requireOptionalNativeModule } = require('expo-modules-core');

function getNative() {
  try {
    const mod = requireOptionalNativeModule('SppFileImport');
    if (mod) return mod;
  } catch (_) {}
  try {
    // Fallback path used by some Expo / New Arch builds.
    const { NativeModulesProxy } = require('expo-modules-core');
    if (NativeModulesProxy?.SppFileImport) return NativeModulesProxy.SppFileImport;
  } catch (_) {}
  return null;
}

function isAvailable() {
  const n = getNative();
  return !!(n && (typeof n.isNativeReady === 'function' ? n.isNativeReady() : n.pickFromStorage));
}

function nativeBuildId() {
  const n = getNative();
  try {
    if (n && typeof n.nativeBuildId === 'function') return String(n.nativeBuildId());
  } catch (_) {}
  return null;
}

async function openWhatsApp() {
  const Native = getNative();
  if (!Native?.openWhatsApp) throw new Error('SppFileImport missing');
  return Native.openWhatsApp();
}

async function listImportApps() {
  const Native = getNative();
  if (!Native?.listImportApps) throw new Error('SppFileImport missing');
  return Native.listImportApps();
}

async function pickFromApp(packageName, activityName, kind) {
  const Native = getNative();
  if (!Native?.pickFromApp) throw new Error('SppFileImport missing');
  return Native.pickFromApp(packageName || '', activityName || null, kind || 'content');
}

async function pickFromApps(options = {}) {
  const Native = getNative();
  if (!Native?.pickFromApps) throw new Error('SppFileImport missing');
  return Native.pickFromApps(!!options.multiple, options.mimeType || '*/*', options.title || 'Import');
}

async function pickFromStorage(options = {}) {
  const Native = getNative();
  if (!Native?.pickFromStorage) throw new Error('SppFileImport missing');
  return Native.pickFromStorage(!!options.multiple, options.mimeType || '*/*');
}

async function takePendingShare() {
  const Native = getNative();
  if (!Native?.takePendingShare) return null;
  return Native.takePendingShare();
}

module.exports = {
  openWhatsApp,
  listImportApps,
  pickFromApp,
  pickFromApps,
  pickFromStorage,
  takePendingShare,
  isAvailable,
  nativeBuildId,
};
