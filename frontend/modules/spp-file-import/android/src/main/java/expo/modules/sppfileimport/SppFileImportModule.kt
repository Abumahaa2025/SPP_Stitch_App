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
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.io.FileOutputStream

private const val REQ_APPS = 51901
private const val REQ_STORAGE = 51902

class PickOptions : Record {
  @Field
  var multiple: Boolean = true

  @Field
  var mimeType: String = "*/*"

  @Field
  var title: String = "Import file"
}

class SppFileImportModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var pendingPromise: Promise? = null
  private var pendingRequest: Int = 0

  override fun definition() = ModuleDefinition {
    Name("SppFileImport")

    AsyncFunction("pickFromApps") { options: PickOptions, promise: Promise ->
      if (pendingPromise != null) {
        promise.reject("E_BUSY", "A file pick is already in progress", null)
        return@AsyncFunction
      }
      pendingPromise = promise
      pendingRequest = REQ_APPS

      val getContent = Intent(Intent.ACTION_GET_CONTENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = options.mimeType.ifBlank { "*/*" }
        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, options.multiple)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }

      val chooser = Intent.createChooser(getContent, options.title).apply {
        // Put WhatsApp / WhatsApp Business at the top of the chooser.
        val initial = preferredWhatsAppIntents(options.mimeType)
        if (initial.isNotEmpty()) {
          putExtra(Intent.EXTRA_INITIAL_INTENTS, initial.toTypedArray())
        }
      }

      try {
        appContext.throwingActivity.startActivityForResult(chooser, REQ_APPS)
      } catch (e: Exception) {
        pendingPromise = null
        promise.reject("E_START", e.message, e)
      }
    }

    AsyncFunction("pickFromStorage") { options: PickOptions, promise: Promise ->
      if (pendingPromise != null) {
        promise.reject("E_BUSY", "A file pick is already in progress", null)
        return@AsyncFunction
      }
      pendingPromise = promise
      pendingRequest = REQ_STORAGE

      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = options.mimeType.ifBlank { "*/*" }
        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, options.multiple)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        // Start at internal storage root instead of Downloads.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          val root = Uri.parse("content://com.android.externalstorage.documents/document/primary:")
          putExtra(DocumentsContract.EXTRA_INITIAL_URI, root)
        }
      }

      try {
        appContext.throwingActivity.startActivityForResult(intent, REQ_STORAGE)
      } catch (e: Exception) {
        pendingPromise = null
        promise.reject("E_START", e.message, e)
      }
    }

    OnActivityResult { _, (requestCode, resultCode, data) ->
      if (requestCode != pendingRequest || pendingPromise == null) return@OnActivityResult
      val promise = pendingPromise!!
      pendingPromise = null
      pendingRequest = 0

      if (resultCode != Activity.RESULT_OK || data == null) {
        promise.resolve(
          mapOf(
            "canceled" to true,
            "assets" to null,
          ),
        )
        return@OnActivityResult
      }

      try {
        val assets = mutableListOf<Map<String, Any?>>()
        val clip = data.clipData
        if (clip != null) {
          for (i in 0 until clip.itemCount) {
            clip.getItemAt(i)?.uri?.let { uri ->
              toAsset(uri)?.let { assets.add(it) }
            }
          }
        } else {
          data.data?.let { uri ->
            toAsset(uri)?.let { assets.add(it) }
          }
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

  private fun preferredWhatsAppIntents(mimeType: String): List<Intent> {
    val pm = context.packageManager
    val packages = listOf("com.whatsapp", "com.whatsapp.w4b")
    val out = mutableListOf<Intent>()
    for (pkg in packages) {
      try {
        pm.getPackageInfo(pkg, 0)
      } catch (_: PackageManager.NameNotFoundException) {
        continue
      }
      // Prefer GET_CONTENT targeted at WhatsApp so it appears first in the chooser.
      val targeted = Intent(Intent.ACTION_GET_CONTENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = mimeType.ifBlank { "*/*" }
        setPackage(pkg)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val resolved = pm.queryIntentActivities(targeted, 0)
      if (resolved.isNotEmpty()) {
        val ri = resolved[0]
        targeted.component = ComponentName(ri.activityInfo.packageName, ri.activityInfo.name)
        out.add(targeted)
      } else {
        // Fallback: open WhatsApp itself (user can share/export a file).
        val launch = pm.getLaunchIntentForPackage(pkg)
        if (launch != null) out.add(launch)
      }
    }
    return out
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
      "uri" to Uri.fromFile(dest).toString(),
      "mimeType" to (mime ?: "application/octet-stream"),
      "size" to (size ?: dest.length()),
    )
  }
}
