/**
 * Push notifications through Firebase Cloud Messaging (FCM).
 *
 * The app holds no Firebase server key or service account. Notifications are sent from WordPress
 * (Fileora → App Center → Notifications), which keeps the service account on the server, or from
 * the Firebase Console.
 *
 * App 1.2, direct delivery (plugin 2.22+, config.push_direct): the app registers this phone's FCM
 * token with its choices (categories, quiet, private, version) at /wp-json/fileora/v1/app-push-token.
 * The website then sends each notification straight to the phone — Firebase's fast path — instead
 * of through topics, which Firebase delivers "optimised for throughput, not latency" (often seconds
 * later). Once the website has accepted the token the app leaves the old topics, so a notification
 * never arrives twice; it keeps "app-all" and "app-android"/"app-ios" for the Firebase Console.
 * Without a plugin that supports it (or while the website can't be reached) the topics below stay.
 *
 * Topics: all (important, always on while notifications are on), android, v<version> (so the
 * website can reach only older versions), the categories the person keeps on in Settings
 * (updates, news, tools, offers, blog), and their style: mode-quiet (no sound or pop-up) and
 * mode-private (nothing on the lock screen). App Center sends each notification once per style.
 *
 * Android 13+ needs the POST_NOTIFICATIONS permission, iOS asks once. App 1.2 asks on the first-launch
 * permissions screen (components/Onboarding), after explaining why, or when the person taps
 * "Turn on" (Home card or Settings); a "no" is respected and never asked again automatically.
 *
 * While the app is open: Android shows nothing by itself, so the app shows the notification
 * (native FileoraNotify, same channel and Fileora sound); iOS shows it with sound because of
 * firebase.json ("messaging_ios_foreground_presentation_options"). Either way it goes into the
 * Alerts history. App Center can lock settings (Notification & Privacy): effectivePrefs().
 */
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { ANDROID_PACKAGE, SITE } from '../config';
import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  deleteToken,
  getInitialNotification,
  getMessaging,
  getToken,
  hasPermission,
  isDeviceRegisteredForRemoteMessages,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
  subscribeToTopic,
  unsubscribeFromTopic,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { openLink } from '../lib/links';
import { navigationRef } from '../navigation/types';
import { toolById } from '../data/tools';
import { APP_VERSION } from '../version';
import { defaultPrefs, effectivePrefs, PLATFORM, remote, TOPIC_LABELS } from './remote';
import { inbox } from './inbox';
import { showBanner } from '../components/InAppBanner';
import { native } from '../lib/native';
import { telemetry } from './telemetry';
import { featureMessage, screenState } from '../navigation/nav';

export type Permission = 'granted' | 'denied' | 'blocked';

function messaging() {
  try {
    return getMessaging(getApp());
  } catch {
    return null; // e.g. a build without google-services.json
  }
}

/** Whether notifications can work in this build (Firebase configured: always on Android; on iOS when the build has GoogleService-Info.plist). */
export function pushAvailable(): boolean {
  return messaging() !== null;
}

const needsRuntimePermission = () => Platform.OS === 'android' && Number(Platform.Version) >= 33;

export const versionTopic = (v = APP_VERSION) => 'v' + v.replace(/\./g, '-');

const IOS = Platform.OS === 'ios';
/** This phone's platform topic ("android" or "ios"). */
export const platformTopic = IOS ? 'ios' : 'android';

const iosOk = (s: number) => s === AuthorizationStatus.AUTHORIZED || s === AuthorizationStatus.PROVISIONAL;

/** Whether the system lets this app show notifications (Android 13+ permission, iOS permission). */
export async function permission(): Promise<'granted' | 'denied'> {
  if (IOS) {
    const m = messaging();
    if (!m) return 'denied';
    try {
      return iosOk(await hasPermission(m)) ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  if (Platform.OS !== 'android') return 'denied';
  if (!needsRuntimePermission()) return 'granted';
  try {
    return (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Asks for the permission (only call after the person chose to turn notifications on). */
export async function askPermission(): Promise<Permission> {
  if (IOS) {
    const m = messaging();
    if (!m) return 'denied';
    try {
      const before = await hasPermission(m);
      if (before === AuthorizationStatus.DENIED) return 'blocked'; // iOS asks only once: Settings from here on
      return iosOk(await requestPermission(m, { alert: true, badge: false, sound: true })) ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  if (Platform.OS !== 'android') return 'denied';
  if (!needsRuntimePermission()) return 'granted';
  try {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return r === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
  } catch {
    return 'denied';
  }
}

/** The person turns notifications on: ask for permission, then subscribe. */
export async function enableNotifications(): Promise<Permission> {
  remote.setPrefs({ askedAt: Date.now() });
  const p = await askPermission();
  remote.choose({ notify: p === 'granted' });
  await syncTopics();
  return p;
}

export async function disableNotifications() {
  remote.choose({ notify: false });
  await syncTopics();
}

export function openSystemSettings() {
  Linking.openSettings().catch(() => {});
}

/** Android's notification settings for Fileora (sound, pop-up, lock screen…). */
export function openNotificationSettings() {
  if (IOS || Number(Platform.Version) < 26) {
    openSystemSettings();
    return;
  }
  Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [{ key: 'android.provider.extra.APP_PACKAGE', value: ANDROID_PACKAGE }]).catch(openSystemSettings);
}

/**
 * Back to a fresh install's notification choices, with a new anonymous notification ID:
 * every topic is dropped and the FCM token deleted, then the topics are set up again
 * (only if notifications are allowed on this phone).
 */
export async function resetNotifications() {
  const m = messaging();
  const before = remote.get().prefs;
  // anonymous usage is not a notification setting: the person's choice stays
  remote.setPrefs({ ...defaultPrefs(), usage: before.usage, touched: before.touched?.includes('usage') ? ['usage'] : [] });
  if (m) {
    chain = chain
      .then(async () => {
        for (const t of remote.get().subscribed) await unsubscribeFromTopic(m, t).catch(() => {});
        remote.setSubscribed([]);
        await deleteToken(m).catch(() => {});
      })
      .catch(() => {});
    await chain;
  }
  await syncTopics();
}

/* ---------- topics ---------- */

let chain: Promise<void> = Promise.resolve();

function wanted(perm: 'granted' | 'denied'): string[] {
  const s = remote.get();
  const p = effectivePrefs(); // App Center may lock some choices
  if (!p.notify || perm !== 'granted') return [];
  const offered = s.config?.topics?.length ? s.config.topics : TOPIC_LABELS.map(t => t.id);
  const cats = TOPIC_LABELS.map(t => t.id).filter(id => offered.includes(id) && p.topics[id] !== false);
  // iOS: lock-screen privacy is a setting of the iPhone itself ("Show Previews"), not a topic
  const modes = [...(p.quiet ? ['mode-quiet'] : []), ...(p.private && !IOS ? ['mode-private'] : [])];
  return ['all', platformTopic, versionTopic(), ...cats, ...modes];
}

/** Topics of a phone with direct delivery: only for sends from the Firebase Console. */
const DIRECT_TOPICS = ['app-all', `app-${platformTopic}`];
const REG_EVERY = 24 * 3600 * 1000; // re-register daily: keeps the website's copy fresh

/**
 * Registers (or removes) this phone's token with the website for direct delivery.
 * Returns true when the website delivers directly to this phone (it accepted the token).
 */
async function registerDirect(m: NonNullable<ReturnType<typeof messaging>>, on: boolean, cats: string[], force: boolean): Promise<boolean> {
  const s = remote.get();
  if (!s.config?.push_direct || !s.install) return false;
  if (!on && !s.pushReg) return false; // never registered: nothing to remove
  const p = effectivePrefs();
  let token = '';
  if (on) {
    try {
      token = await getToken(m);
    } catch {
      return false;
    }
    if (!token) return false;
  }
  const body = { install: s.install, platform: PLATFORM, version: APP_VERSION, on, token, cats, quiet: p.quiet, private: p.private && !IOS };
  const key = JSON.stringify(body);
  const reg = s.pushReg;
  if (!force && reg && reg.key === key && Date.now() - reg.at < REG_EVERY) return reg.direct;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(`${SITE}/wp-json/fileora/v1/app-push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Cache-Control': 'no-cache' },
      body: key,
      signal: ctl.signal,
    });
    clearTimeout(timer);
    const j = (await r.json().catch(() => null)) as { ok?: boolean; direct?: boolean } | null;
    if (!r.ok || !j?.ok || j.direct !== true) return reg?.direct === true && reg.key === key; // keep the last good state
    remote.setPushReg({ key, at: Date.now(), direct: on });
    return on;
  } catch {
    // offline: keep what the website last confirmed (topics stay if it never confirmed)
    return reg?.direct === true && on && reg.key === key;
  }
}

/** Brings this phone's notification setup in line with the person's choices (runs one at a time). */
export function syncTopics(force = false): Promise<void> {
  chain = chain.then(() => doSync(force)).catch(() => {});
  return chain;
}

async function doSync(force = false) {
  const m = messaging();
  if (!m) return;
  let want = wanted(await permission());
  if (want.length && IOS && !isDeviceRegisteredForRemoteMessages(m)) await registerDeviceForRemoteMessages(m).catch(() => {});
  // app 1.2: direct delivery when the website supports it; then only the Firebase Console topics
  const cats = want.filter(t => TOPIC_LABELS.some(l => l.id === t));
  const direct = await registerDirect(m, want.length > 0, cats, force);
  if (direct && want.length) want = DIRECT_TOPICS;
  const have = remote.get().subscribed;
  if (!want.length && !have.length) return;
  const add = want.filter(t => !have.includes(t));
  const drop = have.filter(t => !want.includes(t));
  if (!add.length && !drop.length) return;
  const done = new Set(have);
  try {
    if (want.length) {
      // iOS: register with Apple's push service first (not automatic, so nothing happens before "Turn on")
      if (IOS && !isDeviceRegisteredForRemoteMessages(m)) await registerDeviceForRemoteMessages(m);
      await getToken(m); // creates the anonymous FCM token if needed
    }
    for (const t of drop) {
      await unsubscribeFromTopic(m, t);
      done.delete(t);
    }
    for (const t of add) {
      await subscribeToTopic(m, t);
      done.add(t);
    }
    if (!want.length) await deleteToken(m).catch(() => {}); // notifications off: drop the token too
  } finally {
    remote.setSubscribed([...done]);
  }
}

/* ---------- opening a notification ---------- */

type Data = { open?: string; tool?: string; link?: string; id?: string; topic?: string; title?: string; body?: string; image?: string; at?: string; more?: string };
let pending: Data | null = null;

export { openLink } from '../lib/links';

/**
 * Opens what a notification points to (a tool, a screen, a link, the update page). Used by the
 * "Open" button of the alert's detail screen, and for Firebase Console notifications without an id.
 */
export function openTarget(d: Data) {
  if (!navigationRef.isReady()) return;
  const open = d.open || 'home';
  if (open === 'tool' && d.tool && toolById(d.tool)) navigationRef.navigate('Tool', { id: d.tool });
  else if (open === 'scanner') {
    const st = screenState('scanner');
    if (st === 'soon' || st === 'off') featureMessage('scanner', 'Scanner');
    else navigationRef.navigate('Tabs', { screen: 'Scanner' });
  }
  else if (open === 'files') navigationRef.navigate('Tabs', { screen: 'Files' });
  else if (open === 'alerts') navigationRef.navigate('Tabs', { screen: 'Alerts' });
  else if (open === 'promo') {
    if (remote.get().config?.promo) navigationRef.navigate('Promo');
    else navigationRef.navigate('Tabs', { screen: 'Alerts' });
  }
  else if (open === 'link' && d.link) openLink(d.link);
  else if (open === 'update') {
    const url = remote.get().config?.update.url || d.link;
    if (url) Linking.openURL(url).catch(() => {});
  } else navigationRef.navigate('Tabs', { screen: 'Home' });
}

/** App 1.2: a tapped notification opens its whole message (title, text, image, date, category). */
function go(d: Data) {
  if (!navigationRef.isReady()) {
    pending = d;
    return;
  }
  const id = String(d.id || '').slice(0, 40);
  if (!id || id === 'test') {
    if (id === 'test') navigationRef.navigate('Tabs', { screen: 'Alerts' });
    else openTarget(d);
    return;
  }
  inbox.markRead(id);
  navigationRef.navigate('Alert', { id });
  // the website's copy has the whole message (a notification carries at most 300 characters)
  remote.refresh(true).catch(() => {});
}

/** Keeps a notification in the Alerts history (those sent from App Center are there anyway). */
function remember(msg: RemoteMessage): string {
  const d = (msg.data || {}) as Data;
  const title = msg.notification?.title || d.title || '';
  const id = String(d.id || msg.messageId || `${Date.now()}`).slice(0, 40);
  if (!title) return id;
  const n = msg.notification as { android?: { imageUrl?: string }; ios?: { imageUrl?: string } } | undefined;
  const image = d.image || n?.android?.imageUrl || n?.ios?.imageUrl || '';
  inbox.add({
    id,
    title: title.slice(0, 200),
    body: String(msg.notification?.body || d.body || '').slice(0, 5000),
    image: /^https:\/\//i.test(image) ? image : '',
    open: d.open || 'home',
    tool: d.tool || '',
    link: d.link || '',
    topic: d.topic || 'all',
    older: '',
    at: Number(d.at) || undefined,
  });
  return id;
}

function opened(msg: RemoteMessage | null) {
  if (!msg) return;
  const d = (msg.data || {}) as Data;
  const id = remember(msg);
  telemetry.track('push', undefined, 0, d.id ? `opened ${String(d.id).slice(0, 40)}` : 'opened');
  go({ ...d, id: d.id || id });
}

/** Android: a notification shown by the app (while it was open) was tapped. */
function openedLocal(json: string | null) {
  if (!json) return;
  try {
    const d = JSON.parse(json) as Data;
    if (d.id) inbox.markRead(String(d.id));
    telemetry.track('push', undefined, 0, d.id ? `opened ${String(d.id).slice(0, 40)}` : 'opened');
    go(d);
  } catch {
    // damaged data: nothing to open
  }
}

/** Opens an alert's detail screen (Alerts screen). */
export function openInboxItem(d: Data) {
  go(d);
}

/** Call once navigation is ready: handles a notification that was tapped while the app was closed. */
export function onNavigationReady() {
  if (pending) {
    const d = pending;
    pending = null;
    go(d);
  }
}

/** Listeners for notifications (call once at start). Returns an unsubscribe function. */
export function startPush(): () => void {
  const m = messaging();
  if (!m) return () => {};
  getInitialNotification(m).then(opened).catch(() => {});
  native.takePushOpen().then(openedLocal).catch(() => {});
  const offLocal = native.onPushOpen(() => native.takePushOpen().then(openedLocal).catch(() => {}));
  const offOpen = onNotificationOpenedApp(m, opened);
  // Firebase replaced this phone's token: tell the website (direct delivery) right away
  const offToken = onTokenRefresh(m, () => {
    syncTopics(true);
  });
  // While the app is open (app 1.2): keep it in Alerts and slide in Fileora's own banner (tap =
  // the whole message). Android also puts a silent copy in the notification shade; iOS lists it
  // in Notification Centre (firebase.json: "list" and "sound", no system banner on top of ours).
  const offMsg = onMessage(m, async msg => {
    const n = msg.notification;
    const d = (msg.data || {}) as Data;
    const title = n?.title || d.title;
    const body = n?.body || d.body || '';
    if (!title && !body) return;
    const id = remember(msg);
    telemetry.track('push', undefined, 0, `received ${id}`);
    remote.refresh(true).catch(() => {}); // the whole message and the updated history
    showBanner({ id, title: title || 'Fileora', body, topic: d.topic || 'all', onPress: () => go({ ...d, id: d.id || id }) });
    if (IOS) return;
    const p = effectivePrefs();
    if (!p.notify || (await permission()) !== 'granted') return;
    native
      .showNotification({
        id: String(d.id || msg.messageId || Date.now()),
        title: title || 'Fileora',
        body,
        quiet: true, // the in-app banner is the pop-up; the shade keeps a copy
        private: p.private,
        data: JSON.stringify({ open: d.open || 'home', tool: d.tool || '', link: d.link || '', id: d.id || id }),
      })
      .catch(() => {});
  });
  return () => {
    offOpen();
    offMsg();
    offLocal();
    offToken();
  };
}

/* ---------- Settings → Check notifications ---------- */

/**
 * Asks the website to send one notification to this phone after a few seconds (App Center →
 * Notifications → "Send a test notification" must be allowed). Returns an error text or null.
 */
export async function requestTestPush(delay = 10): Promise<string | null> {
  const m = messaging();
  if (!m) return 'Notifications aren’t available in this build.';
  if ((await permission()) !== 'granted') return 'Allow notifications for Fileora first.';
  let token = '';
  try {
    if (IOS && !isDeviceRegisteredForRemoteMessages(m)) await registerDeviceForRemoteMessages(m);
    token = await getToken(m);
  } catch {
    return 'This phone couldn’t get a notification ID. Check the internet connection and try again.';
  }
  const p = effectivePrefs();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);
    const r = await fetch(`${SITE}/wp-json/fileora/v1/app-test-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token, platform: PLATFORM, quiet: p.quiet, private: p.private, delay }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (r.ok) return null;
    const j = (await r.json().catch(() => null)) as { message?: string } | null;
    return j?.message || `The website answered ${r.status}.`;
  } catch (e) {
    // the app may have been left before the website answered: the notification is still sent
    return e instanceof Error && e.name === 'AbortError' ? null : 'No connection to the website. Try again.';
  }
}
