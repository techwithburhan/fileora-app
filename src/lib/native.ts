/**
 * Platform helpers.
 * - Android: Fileora's own module (android/app/src/main/java/in/fileora/app/FileoraNativeModule.kt).
 * - iOS: the same functions built from what iOS offers: images shared to Fileora arrive as file
 *   links (Share → Fileora), PDF pages are rendered with react-native-pdf-thumbnail, and sharing
 *   to another app uses the iOS share sheet (iOS doesn't let an app pick the target app itself).
 */
import { DeviceEventEmitter, Linking, NativeModules, Platform, Share } from 'react-native';
import BlobUtil from 'react-native-blob-util';
import PdfThumbnail from 'react-native-pdf-thumbnail';
import { mimeOf, safeName } from '../store/files';

type Shared = { path: string; name: string; mime: string; size: number };
type Page = { path: string; width: number; height: number };
type Native = {
  takeSharedFiles(): Promise<Shared[]>;
  renderPdf(path: string, maxSide: number): Promise<Page[]>;
  isInstalled(pkg: string): Promise<boolean>;
  appIcon(pkg: string, size: number): Promise<string | null>;
  shareToApp(path: string, mime: string, pkg: string): Promise<boolean>;
  openApp(pkg: string): Promise<boolean>;
  showNotification(n: ShowNotification): Promise<boolean>;
  notificationStatus(): Promise<NotifStatus>;
  openNotificationFix(kind: 'channel' | 'battery' | 'autostart'): Promise<string>;
  takePushOpen(): Promise<string | null>;
};
/** A notification shown by the app itself (one that arrived while Fileora is open). */
export type ShowNotification = {
  id: string;
  title: string;
  body: string;
  quiet: boolean;
  private: boolean;
  data: string;
  /** app 1.2: Fileora is open — the Fileora sound without a pop-up (channel "fileora_inapp") */
  inApp?: boolean;
};
/** What can stop notifications on this Android phone (Settings → Check notifications). */
export type NotifStatus = {
  enabled: boolean;
  sdk: number;
  maker: string;
  channel: boolean;
  /** 4 = pop-up and sound, 3 = sound, 2 = silent, 1 = minimised, 0 = off, -1 = channel missing */
  importance: number;
  sound: boolean;
  batteryOptimized: boolean;
  backgroundRestricted: boolean;
  /** the phone has a maker "Autostart" screen Fileora knows how to open */
  autostart: boolean;
};

const N: Native | undefined = Platform.OS === 'android' ? NativeModules.FileoraNative : undefined;
const missing = () => Promise.reject(new Error('Not available on this device.'));
const IOS = Platform.OS === 'ios';

/* ---------- iOS: images shared to Fileora (file:// links from the share sheet) ---------- */

const incoming: string[] = [];
function onUrl(url?: string | null) {
  if (!url || !url.startsWith('file://')) return;
  incoming.push(url);
  DeviceEventEmitter.emit('fileoraShare');
}
if (IOS) {
  Linking.getInitialURL()
    .then(onUrl)
    .catch(() => {});
  Linking.addEventListener('url', e => onUrl(e.url));
}

async function takeIncoming(): Promise<Shared[]> {
  const out: Shared[] = [];
  const fs = BlobUtil.fs;
  while (incoming.length) {
    const url = incoming.shift()!;
    try {
      const src = decodeURIComponent(url.replace(/^file:\/\//, ''));
      const name = safeName(src.slice(src.lastIndexOf('/') + 1) || 'image.jpg');
      const dest = `${fs.dirs.CacheDir}/shared-${Date.now()}-${name}`;
      await fs.cp(src, dest);
      const size = Number((await fs.stat(dest)).size) || 0;
      // iOS puts shared copies in Documents/Inbox: remove ours once copied
      if (src.includes('/Inbox/')) fs.unlink(src).catch(() => {});
      out.push({ path: dest, name, mime: mimeOf(name), size });
    } catch {
      // unreadable link: skip
    }
  }
  return out;
}

async function renderPdfIOS(path: string, maxSide: number): Promise<Page[]> {
  const pages = await PdfThumbnail.generateAllPages(path.startsWith('file://') ? path : `file://${path}`, { quality: 88, maxWidth: maxSide, maxHeight: maxSide });
  return pages.map(p => ({ path: p.uri.replace(/^file:\/\//, ''), width: p.width, height: p.height }));
}

async function shareIOS(path: string): Promise<boolean> {
  const r = await Share.share({ url: path.startsWith('file://') ? path : `file://${path}` });
  return r.action === Share.sharedAction;
}

export const native = {
  available: !!N || IOS,
  takeSharedFiles: (): Promise<Shared[]> => (N ? N.takeSharedFiles() : IOS ? takeIncoming() : Promise.resolve([])),
  renderPdf: (path: string, maxSide = 2200): Promise<Page[]> => (N ? N.renderPdf(path, maxSide) : IOS ? renderPdfIOS(path, maxSide) : missing()),
  /** iOS can't check other apps: cloud apps count as available and files go through the share sheet. */
  isInstalled: (pkg: string): Promise<boolean> => (N ? N.isInstalled(pkg) : Promise.resolve(IOS)),
  appIcon: (pkg: string, size = 96): Promise<string | null> => (N ? N.appIcon(pkg, size) : Promise.resolve(null)),
  shareToApp: (path: string, mime: string, pkg: string): Promise<boolean> => (N ? N.shareToApp(path, mime, pkg) : IOS ? shareIOS(path) : missing()),
  openApp: (pkg: string): Promise<boolean> => (N ? N.openApp(pkg) : Promise.resolve(false)),
  /** Whether "open the app" works for cloud apps (Android only). */
  canOpenApps: !!N,
  /** Android: shows a notification that arrived while the app is open (with the Fileora sound). */
  showNotification: (n: ShowNotification): Promise<boolean> => (N ? N.showNotification(n) : Promise.resolve(false)),
  notificationStatus: (): Promise<NotifStatus | null> => (N ? N.notificationStatus() : Promise.resolve(null)),
  openNotificationFix: (kind: 'channel' | 'battery' | 'autostart'): Promise<string> => (N ? N.openNotificationFix(kind) : Promise.resolve('')),
  /** Data of the in-app notification Fileora was opened from (JSON), once. */
  takePushOpen: (): Promise<string | null> => (N ? N.takePushOpen() : Promise.resolve(null)),
  onPushOpen(cb: () => void) {
    const sub = DeviceEventEmitter.addListener('fileoraPushOpen', cb);
    return () => sub.remove();
  },
  /** Fires when images are shared to Fileora while it is already open. */
  onShare(cb: () => void) {
    const sub = DeviceEventEmitter.addListener('fileoraShare', cb);
    return () => sub.remove();
  },
};
export type { Shared, Page };
