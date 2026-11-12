/** Fileora's own Android helpers (android/app/src/main/java/in/fileora/app/FileoraNativeModule.kt). */
import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

type Shared = { path: string; name: string; mime: string; size: number };
type Page = { path: string; width: number; height: number };
type Native = {
  takeSharedFiles(): Promise<Shared[]>;
  renderPdf(path: string, maxSide: number): Promise<Page[]>;
  isInstalled(pkg: string): Promise<boolean>;
  appIcon(pkg: string, size: number): Promise<string | null>;
  shareToApp(path: string, mime: string, pkg: string): Promise<boolean>;
  openApp(pkg: string): Promise<boolean>;
};

const N: Native | undefined = Platform.OS === 'android' ? NativeModules.FileoraNative : undefined;
const missing = () => Promise.reject(new Error('Not available on this device.'));

export const native = {
  available: !!N,
  takeSharedFiles: (): Promise<Shared[]> => (N ? N.takeSharedFiles() : Promise.resolve([])),
  renderPdf: (path: string, maxSide = 2200): Promise<Page[]> => (N ? N.renderPdf(path, maxSide) : missing()),
  isInstalled: (pkg: string): Promise<boolean> => (N ? N.isInstalled(pkg) : Promise.resolve(false)),
  appIcon: (pkg: string, size = 96): Promise<string | null> => (N ? N.appIcon(pkg, size) : Promise.resolve(null)),
  shareToApp: (path: string, mime: string, pkg: string): Promise<boolean> => (N ? N.shareToApp(path, mime, pkg) : missing()),
  openApp: (pkg: string): Promise<boolean> => (N ? N.openApp(pkg) : Promise.resolve(false)),
  /** Fires when images are shared to Fileora while it is already open. */
  onShare(cb: () => void) {
    const sub = DeviceEventEmitter.addListener('fileoraShare', cb);
    return () => sub.remove();
  },
};
export type { Shared, Page };
