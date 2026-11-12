package `in`.fileora.app

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "FileoraApp"

  /** react-native-screens: don't restore old fragments after the process was killed (avoids a crash). */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    // opened from the share sheet (Gallery → Share → Fileora)
    if (savedInstanceState == null) ShareInbox.offer(intent)
  }

  /** Fileora was already open: keep the new share and tell JavaScript. */
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    if (ShareInbox.offer(intent)) {
      reactHost?.currentReactContext?.emitDeviceEvent(FileoraNativeModule.EVENT_SHARE)
    }
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
