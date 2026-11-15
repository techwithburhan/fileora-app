import FirebaseCore
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Firebase (notifications, analytics) starts only when its iOS config file is in the app:
    // GoogleService-Info.plist from the Firebase console (see docs). Without it the app works,
    // just without notifications and analytics.
    if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
      FirebaseApp.configure()
    }
    return true
  }
}
