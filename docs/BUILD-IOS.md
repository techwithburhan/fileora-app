# Fileora for iPhone: building

Version 1.2.0 · bundle id `in.fileora.app` · iOS 15.1+

An iPhone build that installs on real phones (an IPA, or a TestFlight build) needs an **Apple Developer Program membership** and its signing certificates. Without them you can only make a **Simulator** build, which checks that the app compiles and runs.

## 1. GitHub Actions (no Mac needed)

Actions → **Build iOS app** runs on every push to `main`, on a macOS runner:

- **Without Apple secrets**, it builds for the iOS Simulator, starts the app there and takes screenshots: the `builds-ios` branch and the artifact `fileora-ios-simulator`. This build doesn't install on iPhones.
- **With Apple secrets**, it builds a signed release and uploads it to App Store Connect → TestFlight. Apple then processes it for 10 to 30 minutes, and testers install it with the TestFlight app. From TestFlight, the same build can be submitted to the App Store.

The secrets (Team ID, App Store Connect API key, `GOOGLE_SERVICE_INFO_PLIST`) and the one-time setup are explained step by step in **[IOS-TESTFLIGHT.md](IOS-TESTFLIGHT.md)**. That includes the APNs key that lets Firebase deliver notifications to iPhones.

The version comes from `package.json`. CI sets `MARKETING_VERSION` (1.2.0) from it and a new build number for each upload.

## 2. On a Mac with Xcode 16+

```bash
npm ci
cd ios && bundle install && bundle exec pod install && cd ..
cp /path/to/GoogleService-Info.plist ios/FileoraApp/     # Firebase Console → iOS app; not in the source ZIP
open ios/FileoraApp.xcworkspace
```

In Xcode, open Signing & Capabilities, choose your Team, and keep the Push Notifications and Background Modes → Remote notifications capabilities. Then choose Product → Archive, and Distribute App → App Store Connect (or Ad Hoc for registered test devices).

## 3. iPhone specifics (Apple's rules)

- **Notifications**: iOS asks once. Fileora asks only after the first-launch screen explains why, or when the person taps "Allow". If someone said no, the app offers Settings instead.
- **Camera**: iOS asks the first time the scanner opens, after Fileora's own short explanation (`NSCameraUsageDescription` in Info.plist). Photos are picked with the system picker, so no photo-library permission is needed to choose them. Saving to Photos asks once.
- **Lock-screen privacy** is an iPhone setting (Settings → Notifications → Show Previews), so the app has no own switch for it on iOS.
