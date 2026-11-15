/**
 * Push notifications through Firebase Cloud Messaging (FCM).
 *
 * The app holds no Firebase server key or service account: it only subscribes this phone to
 * topics. Notifications are sent from WordPress (Fileora → App Center → Notifications), which keeps
 * the service account on the server, or from the Firebase Console.
 *
 * Topics: all (important, always on while notifications are on), android, v<version> (so the
 * website can reach only older versions), and the categories the person keeps on in Settings:
 * updates, news, tools, offers, blog.
 *
 * Android 13+ needs the POST_NOTIFICATIONS permission. It is asked only after the person taps
 * "Turn on" (Home card or Settings), never at first launch; a "no" is respected.
 */
import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  deleteToken,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  subscribeToTopic,
  unsubscribeFromTopic,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { SITE_HOSTS } from '../config';
import { navigationRef } from '../navigation/types';
import { toolById } from '../data/tools';
import { APP_VERSION } from '../version';
import { remote, TOPIC_LABELS } from './remote';
import { telemetry } from './telemetry';

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

/** Whether the system lets this app show notifications (Android 13+ permission). */
export async function permission(): Promise<'granted' | 'denied'> {
  if (Platform.OS !== 'android') return 'denied';
  if (!needsRuntimePermission()) return 'granted';
  try {
    return (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Asks for the Android 13+ permission (only call after the person chose to turn notifications on). */
export async function askPermission(): Promise<Permission> {
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

/* ---------- topics ---------- */

let chain: Promise<void> = Promise.resolve();

function wanted(perm: 'granted' | 'denied'): string[] {
  const s = remote.get();
  if (!s.prefs.notify || perm !== 'granted') return [];
  const offered = s.config?.topics?.length ? s.config.topics : TOPIC_LABELS.map(t => t.id);
  const cats = TOPIC_LABELS.map(t => t.id).filter(id => offered.includes(id) && s.prefs.topics[id] !== false);
  return ['all', 'android', versionTopic(), ...cats];
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
    if (want.length) await getToken(m); // creates the anonymous FCM token if needed
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

function isSiteLink(url: string) {
  try {
    const h = new URL(url).host.toLowerCase();
    return SITE_HOSTS.includes(h);
  } catch {
    return false;
  }
}

/** Opens a link inside the app when it is on fileora.in, otherwise in the browser. */
export function openLink(url: string, title = 'Fileora') {
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) return;
  if (isSiteLink(url) && navigationRef.isReady()) navigationRef.navigate('Web', { url, title });
  else Linking.openURL(url).catch(() => {});
}

function go(d: Data) {
  if (!navigationRef.isReady()) {
    pending = d;
    return;
  }
  const open = d.open || 'home';
  if (open === 'tool' && d.tool && toolById(d.tool)) navigationRef.navigate('Tool', { id: d.tool });
  else if (open === 'scanner') navigationRef.navigate('Tabs', { screen: 'Scanner' });
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
    const d = (msg.data || {}) as Data;
    const canOpen = d.open && d.open !== 'home';
    Alert.alert(n?.title || 'Fileora', n?.body || '', canOpen ? [{ text: 'Close', style: 'cancel' }, { text: 'Open', onPress: () => opened(msg) }] : [{ text: 'OK' }]);
  });
  return () => {
    offOpen();
    offMsg();
  };
}
