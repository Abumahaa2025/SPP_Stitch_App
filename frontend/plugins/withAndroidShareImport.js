/**
 * Android share target + package queries for WhatsApp visibility (Android 11+).
 * Keeps SEND filters so SPP appears when sharing from WhatsApp/Files.
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

function ensureIntentFilters(androidManifest) {
  const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);
  mainActivity.$ = mainActivity.$ || {};
  mainActivity.$['android:launchMode'] = 'singleTask';

  const filters = mainActivity['intent-filter'] || [];
  const hasSend = filters.some((f) =>
    (f.action || []).some((a) => a.$?.['android:name'] === 'android.intent.action.SEND'),
  );
  if (!hasSend) {
    filters.push({
      action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: [{ $: { 'android:mimeType': '*/*' } }],
    });
    filters.push({
      action: [{ $: { 'android:name': 'android.intent.action.SEND_MULTIPLE' } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: [{ $: { 'android:mimeType': '*/*' } }],
    });
  }
  mainActivity['intent-filter'] = filters;
  return androidManifest;
}

function ensureQueries(androidManifest) {
  const manifest = androidManifest.manifest;
  if (!manifest.queries) manifest.queries = [{}];
  const q = manifest.queries[0];
  if (!q.package) q.package = [];
  const pkgs = new Set((q.package || []).map((p) => p.$?.['android:name']).filter(Boolean));
  for (const name of ['com.whatsapp', 'com.whatsapp.w4b']) {
    if (!pkgs.has(name)) {
      q.package.push({ $: { 'android:name': name } });
    }
  }
  if (!q.intent) q.intent = [];
  const hasGetContent = q.intent.some((i) =>
    (i.action || []).some((a) => a.$?.['android:name'] === 'android.intent.action.GET_CONTENT'),
  );
  if (!hasGetContent) {
    q.intent.push({
      action: [{ $: { 'android:name': 'android.intent.action.GET_CONTENT' } }],
      data: [{ $: { 'android:mimeType': '*/*' } }],
    });
  }
  const hasWhatsappScheme = q.intent.some((i) =>
    (i.data || []).some((d) => d.$?.['android:scheme'] === 'whatsapp'),
  );
  if (!hasWhatsappScheme) {
    q.intent.push({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      data: [{ $: { 'android:scheme': 'whatsapp' } }],
    });
  }
  return androidManifest;
}

function withAndroidShareImport(config) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = ensureIntentFilters(cfg.modResults);
    cfg.modResults = ensureQueries(cfg.modResults);
    return cfg;
  });
}

module.exports = withAndroidShareImport;
