package `in`.fileora.app

import android.content.ActivityNotFoundException
import android.content.ContentResolver
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import android.util.Base64
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Fileora's own native helpers:
 *  - images shared to Fileora from the Gallery (Android share sheet, ACTION_SEND / SEND_MULTIPLE)
 *  - PDF pages as images for the scanner (Android's PdfRenderer)
 *  - handing a file to a cloud app installed on the phone (Google Drive, JioAICloud, OneDrive)
 */
class FileoraNativeModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName() = NAME

  /** Images from the latest share intent, copied into the app's cache (once; later calls return []). */
  @ReactMethod
  fun takeSharedFiles(promise: Promise) {
    val intent = ShareInbox.take()
    if (intent == null) {
      promise.resolve(Arguments.createArray())
      return
    }
    Thread {
      try {
        promise.resolve(copyShared(intent))
      } catch (e: Exception) {
        promise.reject("SHARE", e.message ?: "The shared file couldn't be read", e)
      }
    }.start()
  }

  private fun copyShared(intent: Intent): WritableArray {
    val uris = mutableListOf<Uri>()
    @Suppress("DEPRECATION")
    when (intent.action) {
      Intent.ACTION_SEND -> {
        val u: Uri? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
          else intent.getParcelableExtra(Intent.EXTRA_STREAM)
        if (u != null) uris.add(u)
      }
      Intent.ACTION_SEND_MULTIPLE -> {
        val list: List<Uri>? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
          else intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
        if (list != null) uris.addAll(list)
      }
    }
    val clip = intent.clipData
    if (uris.isEmpty() && clip != null) for (i in 0 until clip.itemCount) clip.getItemAt(i).uri?.let { uris.add(it) }

    val out = Arguments.createArray()
    val dir = File(ctx.cacheDir, "shared").apply { mkdirs() }
    val resolver = ctx.contentResolver
    for (uri in uris.distinct().take(MAX_FILES)) {
      // Only content:// links from the sharing app (with the temporary read permission it granted).
      if (uri.scheme != ContentResolver.SCHEME_CONTENT) continue
      val mime = resolver.getType(uri) ?: intent.type ?: ""
      if (!mime.startsWith("image/")) continue
      var name = "image"
      var size = -1L
      resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
        if (c.moveToFirst()) {
          c.getString(0)?.let { name = it }
          if (!c.isNull(1)) size = c.getLong(1)
        }
      }
      if (size > MAX_BYTES) continue
      val safe = name.replace(Regex("[^A-Za-z0-9._ -]"), "_").take(80).ifBlank { "image" }
      val file = File(dir, "${System.currentTimeMillis()}-$safe")
      var copied = 0L
      resolver.openInputStream(uri)?.use { input ->
        FileOutputStream(file).use { output ->
          val buf = ByteArray(64 * 1024)
          while (true) {
            val n = input.read(buf)
            if (n < 0) break
            copied += n
            if (copied > MAX_BYTES) break
            output.write(buf, 0, n)
          }
        }
      }
      if (copied <= 0 || copied > MAX_BYTES) {
        file.delete()
        continue
      }
      out.pushMap(Arguments.createMap().apply {
        putString("path", file.absolutePath)
        putString("name", safe)
        putString("mime", mime)
        putDouble("size", copied.toDouble())
      })
    }
    return out
  }

  /** Every page of a PDF as a JPEG (longest side up to maxSide px, white background), max 30 pages. */
  @ReactMethod
  fun renderPdf(path: String, maxSide: Double, promise: Promise) {
    Thread {
      try {
        val src = File(path.removePrefix("file://"))
        ParcelFileDescriptor.open(src, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
          PdfRenderer(pfd).use { renderer ->
            val out = Arguments.createArray()
            val dir = File(ctx.cacheDir, "pdfpages").apply { mkdirs() }
            val stamp = System.currentTimeMillis()
            for (i in 0 until min(renderer.pageCount, MAX_PAGES)) {
              renderer.openPage(i).use { page ->
                val scale = min(4.0, maxSide / max(page.width, page.height))
                val w = max(1, (page.width * scale).roundToInt())
                val h = max(1, (page.height * scale).roundToInt())
                val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                Canvas(bmp).drawColor(Color.WHITE)
                page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                val f = File(dir, "$stamp-${i + 1}.jpg")
                FileOutputStream(f).use { bmp.compress(Bitmap.CompressFormat.JPEG, 92, it) }
                bmp.recycle()
                out.pushMap(Arguments.createMap().apply {
                  putString("path", f.absolutePath)
                  putInt("width", w)
                  putInt("height", h)
                })
              }
            }
            promise.resolve(out)
          }
        }
      } catch (e: SecurityException) {
        promise.reject("PDF", "This PDF is password-protected. Unlock it first.", e)
      } catch (e: Exception) {
        promise.reject("PDF", "This PDF couldn't be opened.", e)
      }
    }.start()
  }

  @ReactMethod
  fun isInstalled(pkg: String, promise: Promise) {
    promise.resolve(installed(pkg))
  }

  private fun installed(pkg: String): Boolean =
    try {
      ctx.packageManager.getPackageInfo(pkg, 0)
      true
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }

  /** The installed app's own icon (PNG, base64), so the app shows each cloud service's real logo. */
  @ReactMethod
  fun appIcon(pkg: String, size: Double, promise: Promise) {
    try {
      val px = size.roundToInt().coerceIn(24, 256)
      val icon = ctx.packageManager.getApplicationIcon(pkg)
      val bmp = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
      icon.setBounds(0, 0, px, px)
      icon.draw(Canvas(bmp))
      val bytes = ByteArrayOutputStream().also { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
      promise.resolve(Base64.encodeToString(bytes, Base64.NO_WRAP))
    } catch (e: Exception) {
      promise.resolve(null)
    }
  }

  /**
   * Sends a Fileora file to one app (e.g. "Upload to Drive", where the app asks which account and
   * folder), or with an empty package to Android's share sheet.
   */
  @ReactMethod
  fun shareToApp(path: String, mime: String, pkg: String, promise: Promise) {
    try {
      val file = File(path.removePrefix("file://"))
      val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.provider", file)
      val send = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        if (pkg.isNotEmpty()) setPackage(pkg)
      }
      val start = if (pkg.isNotEmpty()) send else Intent.createChooser(send, null)
      start.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
      ctx.startActivity(start)
      promise.resolve(true)
    } catch (e: ActivityNotFoundException) {
      promise.reject("SHARE", "This app can't receive files.", e)
    } catch (e: Exception) {
      promise.reject("SHARE", e.message ?: "Couldn't send the file.", e)
    }
  }

  @ReactMethod
  fun openApp(pkg: String, promise: Promise) {
    val launch = ctx.packageManager.getLaunchIntentForPackage(pkg)
    if (launch == null) {
      promise.resolve(false)
      return
    }
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    ctx.startActivity(launch)
    promise.resolve(true)
  }

  companion object {
    const val NAME = "FileoraNative"
    const val EVENT_SHARE = "fileoraShare"
    private const val MAX_FILES = 20
    private const val MAX_BYTES = 60L * 1024 * 1024
    private const val MAX_PAGES = 30
  }
}

/** Holds the latest share intent until JavaScript asks for it. */
object ShareInbox {
  @Volatile private var pending: Intent? = null

  fun offer(intent: Intent?): Boolean {
    val a = intent?.action ?: return false
    if (a != Intent.ACTION_SEND && a != Intent.ACTION_SEND_MULTIPLE) return false
    pending = intent
    return true
  }

  fun take(): Intent? {
    val i = pending
    pending = null
    return i
  }
}
