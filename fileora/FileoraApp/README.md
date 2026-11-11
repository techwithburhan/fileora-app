# Fileora app (React Native) – version 0.2

Package `in.fileora.app` · React Native 0.88 (New Architecture) · Android 7+ · light and dark mode follow the phone

## What's in 0.2
| Part | Details |
|---|---|
| **Logo** | The official Fileora logo (your `fileora.svg`, exact shapes and colours) in the top bar, 32 px high; in dark mode "File" turns white, as on the website. App icon = your F icon. |
| **Splash** | Netflix-style intro: the F icon glows on navy, pulls back, ribbons in the brand colours stream out and the icon zooms through the screen into the app. Matches the Android 12+ system splash, so no white flash. |
| **Navigation** | *Bottom bar*: Home · Tools · Resume · Blog · Contact (sliding pill, springing icons). *Menu* (☰, slides in from the right): All tools + the 7 categories with counts, Home, ATS Resume, Blog, Contact us, API Status, About, FAQ, Security, Privacy policy, Disclaimer, Accessibility, Open fileora.in – the options the website has today. *Search* button in the top bar. |
| **Home** | Animated hero (drifting shapes), search, categories, popular tools, ATS Resume card, latest 3 blog posts (live from fileora.in). |
| **Tools** | All 69 ready tools from the Fileora Core plugin, search (names, descriptions and keywords), category chips, animated grid. Tool screen: description, where it runs (phone / server), **Open** → the tool page from fileora.in inside the app. |
| **Resume** | The website's ATS Resume Builder inside the app. |
| **Blog** | Live posts from `fileora.in/wp-json/wp/v2/posts`, pull to refresh, endless scroll; a post opens inside the app. |
| **Contact** | Native form → the website's own endpoint (`/wp-json/fileora/v1/contact`); messages arrive in **Fileora → Messages** like website messages. |
| **Downloads** | Files made by the tools are saved to **Downloads/Fileora** with an *Open* button. |
| **Analytics** | Google Analytics for Firebase: screens, tool opens. Never file names or contents; advertising ID off. |

**Animations:** Reanimated 4 (UI thread, 60/120 fps). GSAP is a web library and can't animate native React Native views; it keeps running on the website pages shown inside the app.

**No keys in the app:** the app only uses the public website. Server tools go through WordPress (per-task token, limits, file checks), which talks to api.fileora.in with the shared key. Nothing on the website or the server was changed for the app.

## Get the APK (GitHub Actions)
1. Create an empty **private** repository on GitHub.
2. Upload everything in this folder, including `.github/`:
   ```bash
   git init && git add . && git commit -m "Fileora app 0.2"
   git branch -M main && git remote add origin https://github.com/<you>/<repo>.git && git push -u origin main
   ```
3. GitHub → **Actions** → *Build Android APK* runs by itself (about 20–30 minutes).
4. Open the finished run → **Artifacts** → `fileora-apk` → unzip → copy `app-release.apk` to the phone and open it (allow "Install unknown apps" once).

If the build fails, send the red step's log.

## Run on a computer (optional)
Node 22, JDK 17, Android Studio. `npm ci`, then `npx react-native run-android` with a phone (USB debugging) or an emulator.

## Before the Play Store
- This APK is signed with React Native's public **test key**: for testing only. The store version needs your private upload key (kept by you, never in the repository) and an AAB (`./gradlew bundleRelease`).
- Data safety form: App activity (screens, tool opens) and device/app info for Analytics; contact form (name, email, message) when sent; files are processed and not stored.

## Files
| Path | What |
|---|---|
| `App.tsx` | Navigation: native stack (Tabs, Tool, Web) + bottom tabs, splash, menu |
| `src/components/SplashIntro.tsx` | Netflix-style splash |
| `src/components/AppHeader.tsx`, `AnimatedTabBar.tsx`, `MenuSheet.tsx` | Top bar with logo, bottom bar, side menu |
| `src/components/WebPage.tsx`, `src/lib/webBridge.ts`, `src/lib/downloads.ts` | Website pages in the app, downloads |
| `src/screens/*` | Home, Tools, Tool, Resume, Blog, Contact, Web |
| `src/data/tools.ts` | The 69 tools (from the plugin) |
| `src/api/wp.ts`, `src/config.ts` | Website addresses and REST calls |
| `src/assets/brand.ts`, `src/components/Brand.tsx` | Official logo and F icon |
| `android/app/src/main/res/` | App icons, splash icon, navy theme |
| `.github/workflows/android.yml` | APK build on GitHub |
