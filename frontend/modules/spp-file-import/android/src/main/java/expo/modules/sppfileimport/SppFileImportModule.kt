package expo.modules.sppfileimport

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import java.io.File
import java.io.FileOutputStream

private const val REQ_PICK = 51910

class SppFileImportModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var pendingPromise: Promise? = null
  private var pendingRequest: Int = 0

  override fun definition() = ModuleDefinition {
    Name("SppFileImport")

    Function("isNativeReady") { true }

    Function("nativeBuildId") { "spp-file-import-1.0.30" }

    AsyncFunction("openWhatsApp") { promise: Promise ->
      try {
        val pm = context.packageManager
        for (pkg in listOf("com.whatsapp", "com.whatsapp.w4b")) {
          val launch = pm.getLaunchIntentForPackage(pkg)
          if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            appContext.throwingActivity.startActivity(launch)
            promise.resolve(mapOf("ok" to true, "package" to pkg))
            return@AsyncFunction
          }
        }
        promise.resolve(mapOf("ok" to false, "reason" to "not_installed"))
      } catch (e: Exception) {
        promise.reject("E_WA", e.message, e)
      }
    }

    /** In-app app list (WhatsApp packages forced to top even if not GET_CONTENT handlers). */
    AsyncFunction("listImportApps") { promise: Promise ->
      try {
        val pm = context.packageManager
        val probe = Intent(Intent.ACTION_GET_CONTENT).apply {
          addCategory(Intent.CATEGORY_OPENABLE)
          type = "*/*"
        }
        val flags = if (Build.VERSION.SDK_INT >= 23) {
          PackageManager.MATCH_DEFAULT_ONLY
        } else {
          0
        }
        val resolved = pm.queryIntentActivities(probe, flags)
        val seen = LinkedHashSet<String>()
        val apps = mutableListOf<Map<String, Any?>>()

        fun addApp(pkg: String, activity: String?, label: String, kind: String) {
          val key = "$pkg/${activity ?: ""}"
          if (!seen.add(key)) return
          apps.add(
            mapOf(
              "packageName" to pkg,
              "activityName" to activity,
              "label" to label,
              "kind" to kind,
            ),
          )
        }

        // Force WhatsApp rows first (open app → Share to SPP).
        for (pkg in listOf("com.whatsapp", "com.whatsapp.w4b")) {
          try {
            pm.getPackageInfo(pkg, 0)
            val label = try {
              val ai = pm.getApplicationInfo(pkg, 0)
              pm.getApplicationLabel(ai).toString()
            } catch (_: Exception) {
              if (pkg.endsWith("w4b")) "WhatsApp Business" else "WhatsApp"
            }
            addApp(pkg, null, label, "whatsapp")
          } catch (_: PackageManager.NameNotFoundException) {
          }
        }

        // Phone storage / DocumentsUI explicitly
        addApp(
          "com.android.documentsui",
          null,
          "Files / Storage",
          "storage",
        )
        addApp(
          "com.google.android.documentsui",
          null,
          "Files",
          "storage",
        )

        for (ri in resolved) {
          val pkg = ri.activityInfo.packageName
          val act = ri.activityInfo.name
          if (pkg.contains("whatsapp")) continue
          val label = ri.loadLabel(pm)?.toString() ?: pkg
          addApp(pkg, act, label, "content")
        }

        promise.resolve(apps)
      } catch (e: Exception) {
        promise.reject("E_LIST", e.message, e)
      }
    }

    AsyncFunction("pickFromApp") { packageName: String, activityName: String?, kind: String, promise: Promise ->
      when (kind) {
        "whatsapp" -> {
          try {
            val launch = context.packageManager.getLaunchIntentForPackage(packageName)
            if (launch == null) {
              promise.resolve(mapOf("canceled" to true, "assets" to null, "openedWhatsApp" to false))
              return@AsyncFunction
            }
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            appContext.throwingActivity.startActivity(launch)
            // No file yet — JS will takePendingShare after Share → SPP.
            promise.resolve(mapOf("canceled" to true, "assets" to null, "openedWhatsApp" to true))
          } catch (e: Exception) {
            promise.reject("E_WA", e.message, e)
          }
        }
        "storage" -> {
          startPick(promise, buildStorageIntent(true, "*/*"))
        }
        else -> {
          val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            if (!activityName.isNullOrBlank()) {
              component = ComponentName(packageName, activityName)
            } else {
              setPackage(packageName)
            }
          }
          startPick(promise, intent)
        }
      }
    }

    AsyncFunction("pickFromStorage") { multiple: Boolean, mimeType: String, promise: Promise ->
      startPick(promise, buildStorageIntent(multiple, mimeType))
    }

    AsyncFunction("pickFromApps") { multiple: Boolean, mimeType: String, title: String, promise: Promise ->
      // Kept for compatibility — prefer listImportApps + pickFromApp.
      val getContent = Intent(Intent.ACTION_GET_CONTENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = mimeType.ifBlank { "*/*" }
        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      startPick(promise, Intent.createChooser(getContent, title.ifBlank { "Import" }))
    }

    AsyncFunction("takePendingShare") { promise: Promise ->
      try {
        val pending = File(context.cacheDir, "spp-pending-share.json")
        if (!pending.exists()) {
          promise.resolve(mapOf("canceled" to true, "assets" to null))
          return@AsyncFunction
        }
        val raw = pending.readText()
        pending.delete()
        val arr = JSONArray(raw)
        val assets = mutableListOf<Map<String, Any?>>()
        for (i in 0 until arr.length()) {
          val o = arr.getJSONObject(i)
          assets.add(
            mapOf(
              "name" to o.optString("name", "shared-file"),
              "uri" to o.optString("uri"),
              "mimeType" to o.optString("mimeType", "application/octet-stream"),
              "size" to o.optLong("size", 0L),
            ),
          )
        }
        if (assets.isEmpty()) {
          promise.resolve(mapOf("canceled" to true, "assets" to null))
        } else {
          promise.resolve(mapOf("canceled" to false, "assets" to assets))
        }
      } catch (e: Exception) {
        promise.reject("E_PENDING", e.message, e)
      }
    }

    OnActivityResult { _, (requestCode, resultCode, data) ->
      if (requestCode != pendingRequest || pendingPromise == null) return@OnActivityResult
      val promise = pendingPromise!!
      pendingPromise = null
      pendingRequest = 0

      if (resultCode != Activity.RESULT_OK || data == null) {
        promise.resolve(mapOf("canceled" to true, "assets" to null))
        return@OnActivityResult
      }

      try {
        val assets = mutableListOf<Map<String, Any?>>()
        val clip = data.clipData
        if (clip != null) {
          for (i in 0 until clip.itemCount) {
            clip.getItemAt(i)?.uri?.let { uri -> toAsset(uri)?.let { assets.add(it) } }
          }
        } else {
          data.data?.let { uri -> toAsset(uri)?.let { assets.add(it) } }
        }
        if (assets.isEmpty()) {
          promise.resolve(mapOf("canceled" to true, "assets" to null))
        } else {
          promise.resolve(mapOf("canceled" to false, "assets" to assets))
        }
      } catch (e: Exception) {
        promise.reject("E_READ", e.message, e)
      }
    }
  }

  private fun startPick(promise: Promise, intent: Intent) {
    if (pendingPromise != null) {
      promise.reject("E_BUSY", "A file pick is already in progress", null)
      return
    }
    pendingPromise = promise
    pendingRequest = REQ_PICK
    try {
      appContext.throwingActivity.startActivityForResult(intent, REQ_PICK)
    } catch (e: Exception) {
      pendingPromise = null
      pendingRequest = 0
      promise.reject("E_START", e.message, e)
    }
  }

  private fun buildStorageIntent(multiple: Boolean, mimeType: String): Intent {
    val type = mimeType.ifBlank { "*/*" }
    return Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      this.type = type
      putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      putExtra("android.content.extra.SHOW_ADVANCED", true)
      putExtra("android.provider.extra.SHOW_ADVANCED", true)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val rootUri = DocumentsContract.buildDocumentUri(
          "com.android.externalstorage.documents",
          "primary:",
        )
        putExtra(DocumentsContract.EXTRA_INITIAL_URI, rootUri)
      }
    }
  }

  private fun toAsset(uri: Uri): Map<String, Any?>? {
    val resolver = context.contentResolver
    var name = "shared-file"
    var size: Long? = null
    try {
      resolver.query(uri, null, null, null, null)?.use { c ->
        val nameIdx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        val sizeIdx = c.getColumnIndex(OpenableColumns.SIZE)
        if (c.moveToFirst()) {
          if (nameIdx >= 0) name = c.getString(nameIdx) ?: name
          if (sizeIdx >= 0 && !c.isNull(sizeIdx)) size = c.getLong(sizeIdx)
        }
      }
    } catch (_: Exception) {
    }

    val mime = try {
      resolver.getType(uri)
    } catch (_: Exception) {
      null
    }

    val safeName = name.replace(Regex("[^a-zA-Z0-9._-]"), "_")
    val dir = File(context.cacheDir, "spp-file-import")
    if (!dir.exists()) dir.mkdirs()
    val dest = File(dir, "${System.currentTimeMillis()}-$safeName")

    try {
      resolver.openInputStream(uri)?.use { input ->
        FileOutputStream(dest).use { output -> input.copyTo(output) }
      } ?: return null
    } catch (_: Exception) {
      return null
    }

    if (!dest.exists() || dest.length() <= 0L) return null

    return mapOf(
      "name" to name,
      "uri" to dest.toURI().toString(),
      "mimeType" to (mime ?: "application/octet-stream"),
      "size" to (size ?: dest.length()),
    )
  }
}
