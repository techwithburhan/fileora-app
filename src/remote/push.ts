/**
 * Push notifications through Firebase Cloud Messaging (FCM).
 *
 * The app holds no Firebase server key or service account: it only subscribes this phone to
 * topics. Notifications are sent from WordPress (Fileora → App Center → Notifications), which keeps
 * the service account on the server, or from the Firebase Console.
 *
 * Topics: all (important, always on while notifications are on), android, v<version> (so the
 * website can reach only older versions), the categories the person keeps on in Settings
 * (updates, news, tools, offers, blog), and their style: mode-quiet (no sound or pop-up) and
 * mode-private (nothing on the lock screen). App Center sends each notification once per style.
 *
 * Android 13+ needs the POST_NOTIFICATIONS permission. It is asked only after the person taps
 * "Turn on" (Home card or Settings), never at first launch; a "no" is respected.
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
  remote.setPrefs({ notify: p === 'granted' });
  await syncTopics();
  return p;
}

export async function disableNotifications() {
  remote.setPrefs({ notify: false });
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
  const keep = remote.get().prefs.usage;
  remote.setPrefs({ ...defaultPrefs(), usage: keep });
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

/** Brings this phone's FCM topics in line with the person's choices (runs one at a time). */
export function syncTopics(): Promise<void> {
  chain = chain.then(doSync).catch(() => {});
  return chain;
}

async function doSync() {
  const m = messaging();
  if (!m) return;
  const want = wanted(await permission());
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

type Data = { open?: string; tool?: string; link?: string; id?: string; topic?: string; title?: string; body?: string };
let pending: Data | null = null;

export { openLink } from '../lib/links';

function go(d: Data) {
  if (!navigationRef.isReady()) {
    pending = d;
    return;
  }
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

/** Keeps a notification in the Alerts history (those sent from App Center are there anyway). */
function remember(msg: RemoteMessage) {
  const d = (msg.data || {}) as Data;
  const title = msg.notification?.title || d.title || '';
  if (!title) return;
  inbox.add({
    id: String(d.id || msg.messageId || `${Date.now()}`).slice(0, 40),
    title: title.slice(0, 120),
    body: String(msg.notification?.body || d.body || '').slice(0, 400),
    image: '',
    open: d.open || 'home',
    tool: d.tool || '',
    link: d.link || '',
    topic: d.topic || 'all',
    older: '',
  });
}

function opened(msg: RemoteMessage | null) {
  if (!msg) return;
  const d = (msg.data || {}) as Data;
  remember(msg);
  telemetry.track('push', undefined, 0, d.id ? `opened ${String(d.id).slice(0, 40)}` : 'opened');
  go(d);
}

/** Android: a notification shown by the app (while it was open) was tapped. */
function openedLocal(json: string | null) {
  if (!json) return;
  try {
    const d = JSON.parse(json) as Data;
    telemetry.track('push', undefined, 0, d.id ? `opened ${String(d.id).slice(0, 40)}` : 'opened');
    go(d);
  } catch {
    // damaged data: nothing to open
  }
}

/** Opens what a history item points to (Alerts screen). */
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
  // While the app is open: keep it in Alerts, and on Android show it like any other notification
  // (Fileora sound, pop-up, lock-screen privacy). iOS shows it itself (firebase.json).
  const offMsg = onMessage(m, async msg => {
    const n = msg.notification;
    const d = (msg.data || {}) as Data;
    const title = n?.title || d.title;
    const body = n?.body || d.body || '';
    if (!title && !body) return;
    remember(msg);
    if (IOS) return;
    const p = effectivePrefs();
    if (!p.notify || (await permission()) !== 'granted') return;
    native
      .showNotification({
        id: String(d.id || msg.messageId || Date.now()),
        title: title || 'Fileora',
        body,
        quiet: p.quiet,
        private: p.private,
        data: JSON.stringify({ open: d.open || 'home', tool: d.tool || '', link: d.link || '', id: d.id || '' }),
      })
      .catch(() => {});
  });
  return () => {
    offOpen();
    offMsg();
    offLocal();
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
