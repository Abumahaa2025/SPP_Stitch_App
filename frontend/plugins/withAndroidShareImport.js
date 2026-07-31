/**
 * Android share target + WhatsApp package queries + MainActivity SEND ingest.
 * Writes shared files into cache/spp-pending-share.json for SppFileImport.takePendingShare().
 */
const {
  withAndroidManifest,
  withMainActivity,
  AndroidConfig,
} = require('@expo/config-plugins');

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
    if (!pkgs.has(name)) q.package.push({ $: { 'android:name': name } });
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

const SHARE_HELPER_KT = `
  private fun sppHandleIncomingShare(intent: android.content.Intent?) {
    if (intent == null) return
    val action = intent.action ?: return
    if (action != android.content.Intent.ACTION_SEND && action != android.content.Intent.ACTION_SEND_MULTIPLE) return
    try {
      val uris = java.util.ArrayList<android.net.Uri>()
      if (action == android.content.Intent.ACTION_SEND) {
        val one = if (android.os.Build.VERSION.SDK_INT >= 33) {
          intent.getParcelableExtra(android.content.Intent.EXTRA_STREAM, android.net.Uri::class.java)
        } else {
          @Suppress("DEPRECATION")
          intent.getParcelableExtra(android.content.Intent.EXTRA_STREAM) as? android.net.Uri
        }
        if (one != null) uris.add(one)
      } else {
        val many = if (android.os.Build.VERSION.SDK_INT >= 33) {
          intent.getParcelableArrayListExtra(android.content.Intent.EXTRA_STREAM, android.net.Uri::class.java)
        } else {
          @Suppress("DEPRECATION")
          intent.getParcelableArrayListExtra<android.net.Uri>(android.content.Intent.EXTRA_STREAM)
        }
        if (many != null) uris.addAll(many)
      }
      if (uris.isEmpty()) return

      val dir = java.io.File(cacheDir, "spp-shared")
      if (!dir.exists()) dir.mkdirs()
      val out = org.json.JSONArray()
      for ((index, uri) in uris.withIndex()) {
        try {
          contentResolver.takePersistableUriPermission(
            uri,
            android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
          )
        } catch (_: Throwable) {}
        var name = "shared-" + index
        try {
          contentResolver.query(uri, null, null, null, null)?.use { c ->
            val idx = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && c.moveToFirst()) {
              val n = c.getString(idx)
              if (!n.isNullOrBlank()) name = n
            }
          }
        } catch (_: Throwable) {}
        val safe = name.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        val dest = java.io.File(dir, System.currentTimeMillis().toString() + "-" + safe)
        try {
          contentResolver.openInputStream(uri)?.use { input ->
            java.io.FileOutputStream(dest).use { output -> input.copyTo(output) }
          }
        } catch (_: Throwable) { continue }
        if (!dest.exists() || dest.length() <= 0L) continue
        val obj = org.json.JSONObject()
        obj.put("name", name)
        obj.put("uri", dest.toURI().toString())
        obj.put("mimeType", contentResolver.getType(uri) ?: "application/octet-stream")
        obj.put("size", dest.length())
        out.put(obj)
      }
      if (out.length() == 0) return
      java.io.File(cacheDir, "spp-pending-share.json").writeText(out.toString())
    } catch (_: Throwable) {}
  }
`;

function withShareMainActivity(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt' && cfg.modResults.language !== 'java') {
      // Expo usually generates Kotlin; still try.
    }
    let src = cfg.modResults.contents;
    if (src.includes('sppHandleIncomingShare')) return cfg;

    // Inject helper before final class closing brace.
    const lastBrace = src.lastIndexOf('}');
    if (lastBrace === -1) return cfg;
    src = src.slice(0, lastBrace) + '\n' + SHARE_HELPER_KT + '\n' + src.slice(lastBrace);

    // Call after super.onCreate(...)
    if (src.includes('super.onCreate(null)')) {
      src = src.replace(
        'super.onCreate(null)',
        'super.onCreate(null)\n    sppHandleIncomingShare(intent)',
      );
    } else if (/super\.onCreate\(savedInstanceState\)/.test(src)) {
      src = src.replace(
        'super.onCreate(savedInstanceState)',
        'super.onCreate(savedInstanceState)\n    sppHandleIncomingShare(intent)',
      );
    }

    if (/override fun onNewIntent/.test(src)) {
      src = src.replace(
        /override fun onNewIntent\([^\)]*\)\s*\{/,
        (m) => `${m}\n    setIntent(intent)\n    sppHandleIncomingShare(intent)`,
      );
    } else {
      src = src.replace(
        SHARE_HELPER_KT,
        `
  override fun onNewIntent(intent: android.content.Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    sppHandleIncomingShare(intent)
  }
` + SHARE_HELPER_KT,
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

function withAndroidShareImport(config) {
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = ensureIntentFilters(cfg.modResults);
    cfg.modResults = ensureQueries(cfg.modResults);
    return cfg;
  });
  config = withShareMainActivity(config);
  return config;
}

module.exports = withAndroidShareImport;
