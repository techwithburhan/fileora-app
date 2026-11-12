# Fileora app (React Native) – version 0.3

Package `in.fileora.app` · React Native 0.88 (New Architecture) · Android 7+ · light/dark mode (phone setting or your choice in Settings)

## What's in 0.3
| Part | Details |
|---|---|
| **Navigation** | *Bottom bar (6)*: Home · Tools · Scanner · Files · Resume · Settings. *Menu* (☰): all tools + the 7 categories, Home, Scanner, Files, ATS Resume, Blog, Settings, Contact us, API Status and the information pages. |
| **Home** | Hero with **Browse by tools**, **Downloads** and **ATS Resume**; search; **Recently used**; the 7 categories; **Your most used tools** (from your own usage, filled up with popular tools until you have history); **Your files** with Downloaded / Opened / Processed tabs; **Your activity**: donut of tool uses by category and a 7-day bar chart of MB/GB processed (tap a segment or bar for its value), both from the history kept on the phone. Empty states until there is real data. |
| **Downloads** (Activity) | Downloaded · Opened · Processed lists with thumbnails, size, pages, date and tool; open or delete. |
| **Tools** | All 69 ready tools. These work natively in the app: **Merge PDF** (pick 2+, add more, reorder, remove, thumbnails), **Watermark** and **Page numbers** on the phone (pdf-lib), and **Compress, Word/Excel/PowerPoint → PDF, PDF → Word/Excel/PowerPoint, OCR, PDF/A, Repair, Protect, Unlock** through the website's public API (queue position, errors, cancel). The rest open their fileora.in page inside the app. Originals are never changed. |
| **Your file is ready** | Pop-up after every task: open the file, or keep going with it (after Merge: Compress, Sign, Watermark, Page numbers). |
| **Scanner** | **+** → *Camera*: Google's ML Kit document scanner (auto edges, crop & rotate, filters, clean, retake, more pages, gallery import) → JPG pages + PDF. *Gallery*: pick photos → review (order, discard with "Are you sure you want to discard this image?", add pages) → PDF. Two sections: Scanned images, Converted PDFs. |
| **Files** | My Storage (real size and counts of Fileora's files, processed count, phone used/free space), Internal storage (Android file picker → open), filters All Files / PDF / Images / Documents / Folders (Downloads, Processed, Scans). |
| **Settings** | Account (currently free to use), Dark mode (saved on the phone), Terms & Conditions, Privacy Policy, About, Contact (website pages), Share application (Android share sheet: WhatsApp, etc.). Footer: Fileora logo, version, "Developed by @techdeployers" → www.techdeployers.com. |
| **Saving** | Results: the app's own Fileora folder (shown in Files) + a copy in **Downloads/Fileora**. |
| **Analytics** | Google Analytics for Firebase: screens, tool opens. Never file names or contents; advertising ID off. The Home charts and lists use only the history file on the phone. |

**Permissions:** Internet; storage only on Android 7–9 (for Downloads/Fileora). No camera permission (the scanner runs in Google Play services), no location, no advertising ID.

**No keys in the app:** the app only uses the public website. Server tools go through WordPress (per-task token, daily limit, file checks), which forwards them to the processing server. Nothing on the website or the server was changed for the app.

**Website pages used by Settings** are found by slug: Terms (`terms-and-conditions`, `terms-of-service`, `terms-of-use`, `terms`), Privacy (`privacy-policy`), About (`about-us`, `about`), Contact (`contact`, `contact-us`). If a page doesn't exist on the site, the app says so.

## Get the APK
Every push to `main` builds the APK on GitHub Actions (about 15 minutes):
- **Actions** → the run → **Artifacts** → `fileora-apk`, or
- the `builds` branch → `fileora-app.apk`.

Version: `package.json` → `version` (Gradle uses it: 0.3.0 → versionName 0.3.0, versionCode 300).

## Run on a computer (optional)
Node 22, JDK 17, Android Studio. `npm ci`, then `npx react-native run-android` with a phone (USB debugging) or an emulator.

## Before the Play Store
- This APK is signed with React Native's public **test key**: for testing only. The store version needs your private upload key (kept by you, never in the repository) and an AAB (`./gradlew bundleRelease`).
- Data safety form: app activity (screens, tool opens) and device/app info for Analytics; files sent to server tools are processed and deleted after download (or within 1 hour); files, scans and history in the app stay on the phone.

## Files
| Path | What |
|---|---|
| `App.tsx` | Native stack (Tabs, Tool, Process, Web, Activity, ScanReview, Blog) + 6 bottom tabs, splash, menu |
| `src/screens/` | Home, Tools, Tool, Process (native tools), Scanner, ScanReview, Files, Activity, Resume, Settings, Blog, Web |
| `src/store/` | On-phone state (files, usage history, theme), derived numbers for Home, file helpers |
| `src/lib/pdf.ts` | Merge, watermark, page numbers, images → PDF (pdf-lib) |
| `src/lib/serverJob.ts` | Server tools through `fileora.in/wp-json/fileora/v1/jobs` |
| `src/lib/scan.ts`, `pick.ts`, `output.ts` | Scanner, file picker, saving results |
| `src/data/nativeTools.ts` | Which tools run natively, their options, related tools |
| `src/components/UsageCharts.tsx` | Donut and 7-day bars |
| `src/components/` | Header, tab bar, menu, file rows/thumbnails, result pop-up, splash |
| `src/data/tools.ts` | The 69 tools (from the plugin) |
| `src/api/wp.ts`, `src/config.ts` | Website addresses and REST calls |
| `.github/workflows/android.yml` | APK build on GitHub |
