package `in`.fileora.app

import android.app.ActivityManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Notifications that arrive while Fileora is open (Android doesn't show those itself), the
 * notification check in Settings, and the phone settings it links to.
 *
 * A notification shown here uses the same channels as Firebase ("fileora_alerts" with the
 * Fileora sound, "fileora_quiet" without), so sound, pop-up and lock-screen privacy follow
 * the person's choices. Tapping it opens Fileora with the notification's data, which
 * JavaScript reads through [PushInbox].
 */
object FileoraNotify {
  const val CHANNEL = "fileora_alerts"
  const val CHANNEL_QUIET = "fileora_quiet"
  /** app 1.2: while Fileora is open — sound, no pop-up (the app shows its own banner) */
  const val CHANNEL_INAPP = "fileora_inapp"
  const val EXTRA = "fileora_push"
  const val ACTION_OPEN = "in.fileora.app.OPEN_NOTIFICATION"

  fun show(ctx: Context, id: String, title: String, body: String, quiet: Boolean, private: Boolean, data: String, inApp: Boolean = false): Boolean {
    val nm = NotificationManagerCompat.from(ctx)
    if (!nm.areNotificationsEnabled()) return false
    val open = Intent(ctx, MainActivity::class.java).apply {
      action = ACTION_OPEN
      putExtra(EXTRA, data)
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val code = (id.ifEmpty { title }).hashCode()
    val pi = PendingIntent.getActivity(ctx, code, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val b = NotificationCompat.Builder(ctx, if (quiet) CHANNEL_QUIET else if (inApp) CHANNEL_INAPP else CHANNEL)
      .setSmallIcon(R.drawable.ic_notification)
      .setColor(0xFF17AF64.toInt())
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setContentIntent(pi)
      .setPriority(if (quiet) NotificationCompat.PRIORITY_LOW else if (inApp) NotificationCompat.PRIORITY_DEFAULT else NotificationCompat.PRIORITY_HIGH)
      .setVisibility(if (private) NotificationCompat.VISIBILITY_SECRET else NotificationCompat.VISIBILITY_PRIVATE)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      // Android 7 and older have no channels: the sound is set on the notification
      if (quiet) b.setSilent(true)
      else b.setSound(Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + ctx.packageName + "/" + R.raw.fileora_notify))
    }
    return try {
      nm.notify("fileora-" + id.take(20), code, b.build())
      true
    } catch (e: SecurityException) {
      false // notifications permission was removed meanwhile
    }
  }

  /** What can stop notifications on this phone, for Settings → Check notifications. */
  fun status(ctx: Context): Map<String, Any> {
    val out = HashMap<String, Any>()
    out["enabled"] = NotificationManagerCompat.from(ctx).areNotificationsEnabled()
    out["sdk"] = Build.VERSION.SDK_INT
    out["maker"] = Build.MANUFACTURER ?: ""
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = ctx.getSystemService(NotificationManager::class.java)
      val ch = nm?.getNotificationChannel(CHANNEL)
      out["channel"] = ch != null
      out["importance"] = ch?.importance ?: -1 // 4 = pop-up, 3 = sound, 2 = silent, 0 = off
      out["sound"] = ch?.sound != null
    } else {
      out["channel"] = true
      out["importance"] = 4
      out["sound"] = true
    }
    val pm = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager
    out["batteryOptimized"] = pm?.isIgnoringBatteryOptimizations(ctx.packageName) == false
    out["backgroundRestricted"] = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      (ctx.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager)?.isBackgroundRestricted == true
    } else false
    out["autostart"] = autostartIntents(ctx).isNotEmpty()
    return out
  }

  /** Settings → Notifications → "Updates and news" (sound and pop-up). */
  fun channelSettings(ctx: Context): Intent =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
        .putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL)
    } else appDetails(ctx)

  /** App info page: Battery → Unrestricted, and other permissions. */
  fun appDetails(ctx: Context): Intent =
    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName))

  /** Phone makers' "Autostart" screens (Xiaomi, Vivo, Oppo, Realme, Huawei…), most likely first. */
  fun autostartIntents(ctx: Context): List<Intent> {
    val maker = (Build.MANUFACTURER ?: "").lowercase()
    val all = listOf(
      "xiaomi" to ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
      "redmi" to ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
      "poco" to ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
      "oppo" to ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
      "oppo" to ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
      "realme" to ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
      "oneplus" to ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"),
      "vivo" to ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
      "vivo" to ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
      "huawei" to ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
      "honor" to ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
      "asus" to ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"),
    )
    return all.filter { maker.contains(it.first) }.map { Intent().setComponent(it.second) }
  }

  /** Opens the first screen that works. Returns what was opened: "autostart", "app" or "". */
  fun openAutostart(ctx: Context): String {
    for (i in autostartIntents(ctx)) {
      try {
        ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        return "autostart"
      } catch (e: Exception) {
        // not on this phone's version: try the next one
      }
    }
    return if (start(ctx, appDetails(ctx))) "app" else ""
  }

  fun start(ctx: Context, i: Intent): Boolean =
    try {
      ctx.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    } catch (e: Exception) {
      false
    }
}

/** Holds the data of the notification Fileora was opened from until JavaScript asks for it. */
object PushInbox {
  @Volatile private var pending: String? = null

  fun offer(intent: Intent?): Boolean {
    val d = intent?.getStringExtra(FileoraNotify.EXTRA) ?: return false
    pending = d
    intent.removeExtra(FileoraNotify.EXTRA) // not again after a rotation or a restart
    return true
  }

  fun take(): String? {
    val d = pending
    pending = null
    return d
  }
}
