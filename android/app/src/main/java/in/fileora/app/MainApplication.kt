package `in`.fileora.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentResolver
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(FileoraNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    loadReactNative(this)
  }

  /**
   * Android 8+: the channels App Center sends to.
   * - "fileora_alerts": with the Fileora sound (res/raw/fileora_notify.ogg) and a pop-up.
   * - "fileora_quiet": for people who chose quiet notifications (no sound, no pop-up).
   * The old "fileora" channel (app 0.5) is removed: a channel's sound can't change after it exists.
   */
  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java) ?: return
    val sound = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + packageName + "/" + R.raw.fileora_notify)
    val audio = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val alerts = NotificationChannel("fileora_alerts", "Updates and news", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "New app versions, new tools, news and offers from Fileora, with the Fileora sound"
      setSound(sound, audio)
      enableVibration(true)
    }
    val quiet = NotificationChannel("fileora_quiet", "Quiet updates", NotificationManager.IMPORTANCE_LOW).apply {
      description = "The same notifications without sound or pop-up (Settings → Quiet notifications)"
      setSound(null, null)
      enableVibration(false)
    }
    nm.createNotificationChannel(alerts)
    nm.createNotificationChannel(quiet)
    nm.deleteNotificationChannel("fileora")
  }
}
