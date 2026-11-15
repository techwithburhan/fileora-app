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
 */
import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { ANDROID_PACKAGE } from '../config';
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
import { defaultPrefs, remote, TOPIC_LABELS } from './remote';
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
  if (!s.prefs.notify || perm !== 'granted') return [];
  const offered = s.config?.topics?.length ? s.config.topics : TOPIC_LABELS.map(t => t.id);
  const cats = TOPIC_LABELS.map(t => t.id).filter(id => offered.includes(id) && s.prefs.topics[id] !== false);
  // iOS: lock-screen privacy is a setting of the iPhone itself ("Show Previews"), not a topic
  const modes = [...(s.prefs.quiet ? ['mode-quiet'] : []), ...(s.prefs.private && !IOS ? ['mode-private'] : [])];
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

type Data = { open?: string; tool?: string; link?: string; id?: string; topic?: string };
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
  else if (open === 'link' && d.link) openLink(d.link);
  else if (open === 'update') {
    const url = remote.get().config?.update.url || d.link;
    if (url) Linking.openURL(url).catch(() => {});
  } else navigationRef.navigate('Tabs', { screen: 'Home' });
}

function opened(msg: RemoteMessage | null) {
  if (!msg) return;
  const d = (msg.data || {}) as Data;
  telemetry.track('push', undefined, 0, d.id ? `opened ${String(d.id).slice(0, 40)}` : 'opened');
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
  const offOpen = onNotificationOpenedApp(m, opened);
  // While the app is open Android doesn't show the notification, so show it here.
  const offMsg = onMessage(m, msg => {
    const n = msg.notification;
    if (!n?.title && !n?.body) return;
    if (remote.get().prefs.quiet) return; // quiet notifications: no pop-up inside the app either
    const d = (msg.data || {}) as Data;
    const canOpen = d.open && d.open !== 'home';
    Alert.alert(n?.title || 'Fileora', n?.body || '', canOpen ? [{ text: 'Close', style: 'cancel' }, { text: 'Open', onPress: () => opened(msg) }] : [{ text: 'OK' }]);
  });
  return () => {
    offOpen();
    offMsg();
  };
}
