# Fileora for Android: building the APK and AAB

Version 1.2.0 · React Native 0.88 · package `in.fileora.app`

You can build in two ways. **GitHub Actions** builds both files for you on every push to `main`. A **local build** works on any Windows, macOS or Linux computer.

## 1. What you need

| Item | Where it comes from |
|---|---|
| This source folder | `fileora-app-1.2.0-source.zip`, or the GitHub repository |
| `android/app/google-services.json` | Firebase Console → Project settings → Your apps → Android app `in.fileora.app` → download. It isn't in the source ZIP. Without it the build fails, because Gradle applies the Google Services plugin. |
| Release signing key (`.keystore` / `.jks`) | Your own key. It must be the same key every time, or phones refuse the update. Keep it in a password manager. Never put it in Git or send it in chat. |
| Node.js 22+, JDK 17, Android SDK platform 37 (compile) and 36 (target), minimum Android 7.0 (API 24). Android Studio installs the SDK. | nodejs.org, adoptium.net, developer.android.com/studio |

The version number comes from `package.json` (`"version": "1.2.0"`). Gradle turns it into `versionName 1.2.0` and `versionCode 10200`, and the app checks force updates against the same number. **To release a new version, change only `package.json`.** In App Center → Force Update, use a number that an APK you have actually published really has.

## 2. Build with GitHub Actions (recommended)

1. Repository → Settings → Secrets and variables → Actions → add these secrets:
   - `FILEORA_KEYSTORE_BASE64`: the keystore file as Base64 (`base64 -w0 fileora.keystore`; on Windows: `certutil -encode`)
   - `FILEORA_KEYSTORE_PASSWORD`, `FILEORA_KEY_ALIAS`, `FILEORA_KEY_PASSWORD`
   - Optional variable `ADMOB_ANDROID_APP_ID` (your AdMob App ID; without it the app can only show test ads)
2. Push to `main`, or open Actions → **Build Android APK** → Run workflow.
3. After about 25 minutes:
   - Actions → the run → Artifacts: `fileora-apk` (the APK, for direct download) and `fileora-aab` (the AAB, for Google Play)
   - the `builds` branch: `fileora-app.apk` and `fileora-app.aab`
   - the `builds-android-test` branch: emulator screenshots and the offline engine's self-test result

Without the signing secrets, the APK is signed with React Native's public test key. That is fine for testing, but not for publishing.

## 3. Build on your own computer

```bash
npm ci                                   # exact versions from package-lock.json
cp /path/to/google-services.json android/app/
# release signing (PowerShell: $env:FILEORA_KEYSTORE_FILE="C:\keys\fileora.keystore")
export FILEORA_KEYSTORE_FILE=/path/to/fileora.keystore
export FILEORA_KEYSTORE_PASSWORD='…'  FILEORA_KEY_ALIAS='…'  FILEORA_KEY_PASSWORD='…'
cd android
./gradlew assembleRelease   # → android/app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease     # → android/app/build/outputs/bundle/release/app-release.aab
```

Before you build, run the same checks as CI: `npx tsc --noEmit && npx eslint App.tsx src && npx jest`.

## 4. Publishing

- **Direct APK** (your website / App Center link): upload `app-release.apk` and put its address in App Center → Force Update → Android → "Download / update link". Then set "Latest version" to the new version. Set "Minimum version" only if old versions must stop working.
- **Google Play**: upload the AAB in Play Console → Release → Production (or Internal testing first). Play App Signing stores Google's copy of the key; keep your upload key safe.

## 5. Check a build before release

| Check | How |
|---|---|
| Version | Settings → "Check for updates" shows `Version 1.2.0`. App Center → Force Update shows it under "Versions in use" after the first check-in. |
| Notifications | Settings → Check notifications → Send a test notification. Also send one from App Center and look at "Phones: x/y accepted". |
| Force update | Set the minimum to the new version: older phones show the update screen, the new one doesn't. |
| Offline engine | open `fileora://selftest` (adb: `adb shell am start -a android.intent.action.VIEW -d fileora://selftest`) |

## 6. Common problems

| Message | Fix |
|---|---|
| `File google-services.json is missing` | Copy it into `android/app/` (step 1). |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` on a phone | The installed app was signed with another key: uninstall it once (files in Fileora are deleted), or always use the same key. |
| Force-update screen still shows after updating | The downloaded APK has an older version than App Center's minimum. Compare Settings → About with App Center → Force Update. App Center warns when no phone has the minimum yet. |
| Gradle out of memory | In `android/gradle.properties`: `org.gradle.jvmargs=-Xmx4g` |
