# Fileora for iPhone: TestFlight, then the App Store

The iOS app is the same Fileora app as the Android APK, built from the same code. It reads App Center the same way: navigation, tools, maintenance, announcements, force update, notifications and monitoring. GitHub Actions builds it on a Mac and uploads it to **App Store Connect → TestFlight**. From TestFlight you install it on iPhones, and later you send the same build to the App Store.

You do the Apple and Firebase steps below **once** (about 30–45 minutes). After that, every push to `main` makes a new TestFlight build.

> [!WARNING]
> The `.p8` keys and `GoogleService-Info.plist` go **only** into GitHub secrets (and the APNs key into Firebase). Never put them in the code, a commit, a chat, an email or a screenshot. If a key leaks, revoke it on the same page where you made it and make a new one.

| You need | Where |
|---|---|
| Apple Developer Program (paid) | developer.apple.com |
| App Store Connect | appstoreconnect.apple.com (same Apple ID) |
| Firebase project **fileora-51ff8** | console.firebase.google.com |
| GitHub repository **techwithburhan/fileora-app** | github.com |

A Mac is **not** needed: the build runs on GitHub's Mac machines.

---

## Step 1. Team ID (Apple Developer)

1. developer.apple.com → **Account** → **Membership details**.
2. Copy the **Team ID** (10 letters and digits). You'll add it as the secret `APPLE_TEAM_ID`.

## Step 2. Register the app ID with push notifications

1. developer.apple.com → **Certificates, Identifiers & Profiles** → **Identifiers** → **+**.
2. **App IDs** → Continue → **App** → Continue.
3. Description: `Fileora`. Bundle ID: **Explicit**, `in.fileora.app`.
4. Under **Capabilities**, tick **Push Notifications**. Continue → **Register**.

## Step 3. APNs key (lets Firebase send notifications to iPhones)

1. Same site → **Keys** → **+**.
2. Key name: `Fileora APNs`. Tick **Apple Push Notifications service (APNs)** → Continue → **Register**.
3. **Download** the `AuthKey_XXXXXXXXXX.p8` file. You can download it only once, so keep it safe until step 7. Note the **Key ID**.

## Step 4. Create the app in App Store Connect

1. appstoreconnect.apple.com → **Apps** → **+** → **New App**.
2. Platform **iOS**. Name: `Fileora`. If that name is taken, use something like `Fileora: PDF & File Tools`.
3. Primary language: English. Bundle ID: **in.fileora.app**. SKU: `fileora-ios`. User access: Full Access → **Create**.

## Step 5. App Store Connect API key (lets GitHub sign and upload)

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API**. The first time, click **Request Access** and accept.
2. **Team Keys** → **+**. Name: `GitHub Fileora`. Access: **Admin**. Admin is needed so the build can create the signing certificate and profile by itself. Click **Generate**.
3. **Download API Key** (`AuthKey_YYYYYYYYYY.p8`, downloadable only once). Note the **Key ID** and the **Issuer ID** shown at the top of the page.

## Step 6. Firebase: add the iOS app

1. console.firebase.google.com → project **fileora-51ff8** → ⚙ **Project settings** → **General** → **Your apps** → **Add app** → **iOS**.
2. Apple bundle ID: `in.fileora.app`. Nickname: `Fileora iOS` → **Register app**.
3. **Download GoogleService-Info.plist**. Skip the remaining steps (the code already has them) → Continue to console.

## Step 7. Firebase: upload the APNs key

1. Firebase → ⚙ **Project settings** → **Cloud Messaging** → **Apple app configuration** → **APNs Authentication Key** → **Upload**.
2. Choose the APNs `.p8` from step 3, then enter its **Key ID** and your **Team ID** → Upload.

## Step 8. GitHub secrets

github.com/techwithburhan/fileora-app → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add these five:

| Name | Value |
|---|---|
| `APPLE_TEAM_ID` | Team ID from step 1 |
| `ASC_KEY_ID` | Key ID of the API key from step 5 |
| `ASC_ISSUER_ID` | Issuer ID from step 5 |
| `ASC_KEY_P8` | Open the API key `.p8` from step 5 in Notepad and paste **everything**, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines |
| `GOOGLE_SERVICE_INFO_PLIST` | Open `GoogleService-Info.plist` from step 6 in Notepad and paste everything |

After that, delete the downloaded files from your computer. The APNs key now lives in Firebase, the API key in GitHub.

## Step 9. Build and upload

1. GitHub → **Actions** → **Build iOS app** → **Run workflow** (or push any change to `main`).
2. The build takes about 30–40 minutes. A green run says **"Uploaded Fileora … to App Store Connect"** in its summary.
3. App Store Connect → **Fileora** → **TestFlight**. The build shows *Processing* for 10–30 minutes, then it is ready. The app already says it uses no special encryption, so there's no export question.

## Step 10. Install on iPhones with TestFlight

**Your team (internal testing, no review, up to 100 people):**
1. App Store Connect → **Users and Access** → add each person with their Apple ID email (role *Developer* or *Marketing* is enough).
2. **TestFlight** → **Internal Testing** → **+** → group `Fileora team` → add those people. The build is added automatically.
3. Each person installs **TestFlight** from the App Store, opens the invitation email → **Accept** → **Install**.

**Anyone (external testing, up to 10,000 people, with a public link):**
1. **TestFlight** → **External Testing** → **+** → group `Public beta` → add the build.
2. Fill in **Test Information**: what to test, a feedback email, and the address of your Privacy Policy page on fileora.in → **Submit for Review**. The first Beta App Review usually takes about a day.
3. Turn on **Public Link** and copy it.
4. WordPress → **Fileora → App Center → Force Update → iOS app**: put that link in **Download / update link** and set **Latest version** (for example `0.6.0`). iPhone users then get the "Update available" banner and the force-update screen with this link.

TestFlight builds expire after 90 days; every new build restarts that.

## Step 11. Later: publish on the App Store

1. App Store Connect → **Fileora** → **App Store** tab → version **0.6.0**.
2. Fill in:
   - **Screenshots:** 6.9" iPhone at minimum (take them in TestFlight on a big iPhone, or in the simulator).
   - Description, keywords, support URL, marketing URL.
   - **App Privacy:** Product Interaction, Other Diagnostic Data and Device ID; all *not linked* to the user and *not used for tracking*. App functionality and analytics.
   - Age rating and price (**Free**).
3. **Build:** choose the TestFlight build → **Add for Review** → **Submit**.
4. After approval, put the App Store link in **App Center → Force Update → iOS app**.

For a new version: raise `"version"` in `package.json` (for example `0.7.0`), push, and a new TestFlight build arrives. Submit it from the App Store tab the same way.

**Direct install without TestFlight** (Ad Hoc) is also possible, but each iPhone's UDID must be registered (up to 100 devices a year) and a new build made. TestFlight is the simpler way to install directly on any iPhone.

---

## What is different on iPhone (Apple's rules, not missing features)

| Feature | Android | iPhone |
|---|---|---|
| Where files are | Files + Downloads/Fileora | Files + the **Files** app → On My iPhone → Fileora |
| Share an image to Fileora | Share → Fileora | Share → Fileora (images) |
| Upload to Google Drive / OneDrive / JioCloud | Opens that app directly | iOS share sheet: choose the app there (iOS doesn't let an app open another app's upload screen) |
| Open a file | Phone's viewer | Quick Look preview, with Share to open it elsewhere |
| Notification permission | Asked after "Turn on" (Android 13+) | Asked after "Turn on"; if refused, only iPhone Settings can turn it on |
| Quiet notifications | Silent channel | Passive notifications (no sound, no banner) |
| Notification privacy (lock screen) | Switch in the app | iPhone Settings → Notifications → Fileora → Show Previews (the app links there) |
| Fileora sound | Yes | Yes |
| App Center (navigation, tools, maintenance, force update, announcements) | Yes | Yes |
| App Monitoring | Android tab | iOS tab (same block) |

## If the build fails

- **Red "Install iOS libraries" or "Build" step:** a code or library problem. Send me the run link and I'll look; nothing secret is in the log.
- **Archive fails with "No profiles for 'in.fileora.app'" or "Cloud signing permission error":** the API key must have **Admin** access (step 5), and the App ID from step 2 must exist.
- **Upload fails with "No suitable application records":** the app from step 4 is missing or has a different bundle ID.
- **Notifications don't arrive:** check step 7 (APNs key in Firebase) and the `GOOGLE_SERVICE_INFO_PLIST` secret. Then, on the iPhone, Settings → Fileora → Notifications should be allowed.
- **Manual signing** (only if automatic signing is refused for your account): add the secrets `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD` and `IOS_PROFILE_BASE64` (an *Apple Distribution* certificate as .p12 and an *App Store* provisioning profile for `in.fileora.app`). The workflow then uses those instead.
