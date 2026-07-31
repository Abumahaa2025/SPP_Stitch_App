/**
 * Android share target without expo-share-intent (that module crashed cold start).
 * Adds SEND / SEND_MULTIPLE so SPP appears in the Share sheet, and singleTask launchMode.
 * Shared files are ingested in JS via DocumentPicker; Share opens the app to Upload.
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

function withAndroidShareImport(config) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = ensureIntentFilters(cfg.modResults);
    return cfg;
  });
}

module.exports = withAndroidShareImport;
