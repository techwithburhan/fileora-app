# App 1.2: how notifications, alerts, force update, permissions and refresh work

For developers who maintain the app. Plugin 2.22+ is needed on the website for direct notifications.

## Notifications (src/remote/push.ts, plugin includes/class-app-push.php)

```
App Center "Send" ──► wp_fileora_app_pushes (history row, status "sending")
                  ├─► FCM topic messages, 4 styles in parallel  ──► apps 1.1 and older
                  └─► one FCM message per registered phone, 50 in parallel (HTTP/2) ──► apps 1.2+
                       results per phone: accepted / failed / removed (UNREGISTERED tokens deleted)
```

- **Registration**: when the website's config has `push_direct: true`, the app POSTs `/wp-json/fileora/v1/app-push-token` with `{install, platform, version, on, token, cats, quiet, private}`. This happens at start, on resume, when settings change, when the token rotates (`onTokenRefresh`), and at least daily. Once the site has accepted the token, the app leaves the old topics and keeps only `app-all` and `app-<platform>` (for the Firebase Console). If registration fails, the old topics stay, so notifications keep arriving.
- **No duplicates**: one token row per phone (the same token under an older install id is deleted). Android `tag` plus `collapse_key`, and iOS `apns-collapse-id`, are `fileora-<id>`, so a repeat replaces the earlier copy. The history is keyed by notification id.
- **App states**: in the foreground, `onMessage` shows Fileora's own banner (components/InAppBanner) plus a silent copy in the Android shade (iOS lists it in Notification Centre: firebase.json `["sound","list"]`). In the background or closed, the system shows it. index.js `setBackgroundMessageHandler` saves a copy to `inbox-pending.json`, and Alerts merges it at the next start.
- **Tracking**: Firebase acceptance per phone (App Center → History), app-reported `push received/opened <id>` events (App Monitoring), and Firebase's own delivery reports (label `push-<id>`).

## Alerts (src/remote/inbox.ts, screens/AlertsScreen + AlertDetailScreen)

- The source of truth is the website history (`inbox` in app-config: up to 100 items, 30 days by default, full text up to 1000 characters). Phones that were offline get it at their next refresh. The phone's own copies (foreground, tapped, background) are merged by id. The website copy wins for the text; the phone copy keeps the time it arrived.
- **Read state**: per id (`read[]`) plus `readBefore` ("Mark all as read", and the 2-day starting point of a fresh install). Opening the detail screen marks the alert read. A tapped notification opens the detail screen. Its button opens the target (tool, link, update, …).
- Read state is kept per phone: the app has no accounts.

## Force update (src/remote/remote.ts `requiredVersion` / `mustUpdate`, components/RemoteGate)

- Versions are normalised (`v1.2`, ` 1.2.0 `, `1.2.0-beta`), and `1.2` equals `1.2.0`.
- The screen shows only when App Center's switch is on and `installed < min(minimum, latest)`. A minimum above "latest" can't block an app that already has the newest version.
- "Try again" always asks the website (no cached copy). The screen shows the installed and the required version. App Center can set its own title and text with `{version}` and `{required}`.
- Tests: `__tests__/version.test.ts`.

## Fresh data (pull-to-refresh, resume)

- The config request uses a unique URL, `Cache-Control: no-cache` and `If-None-Match`. The plugin answers `no-store` with an ETag, and `304` when nothing changed. A LiteSpeed/WP Rocket/CDN copy or the phone's HTTP cache can no longer show old settings.
- Pull-to-refresh: the ring turns until the request has finished, then shows "Updated" or "Couldn't refresh. Showing saved info." It never shows success without new data. Coming back to the app refreshes at most once every 15 seconds.

## Permissions (components/Onboarding, lib/capture.ts)

| Feature | Android | iPhone |
|---|---|---|
| Notifications | POST_NOTIFICATIONS (13+), asked on the first-launch screen after the explanation, or from Settings | asked once, the same way |
| Choose files and photos | system pickers, no permission | system picker, no permission |
| Save to Downloads | Android 9 and older: storage, asked at the first save | — |
| Save to Photos | — | NSPhotoLibraryAddUsageDescription, asked once |
| Camera / scanner | none (Google's scanner or the camera app; CAMERA is removed from the manifest) | asked at the first scan, after Fileora's explanation |

A "no" is never asked again automatically. If the permission is blocked, the app offers the phone's Settings. A permission revoked in the phone's settings is noticed on resume (topics and direct registration are removed).

## CI deep links (screenshots, local tests)

`fileora://setup`, `fileora://setup/done`, `fileora://demo/alerts`, `fileora://demo/alert`, `fileora://demo/banner` (iOS: launch arguments `-FileoraSetup`, `-FileoraDemo`). Demo alerts exist only on that phone and their ids start with `demo-`.
