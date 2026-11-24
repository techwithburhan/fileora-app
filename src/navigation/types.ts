import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CategoryId } from '../data/tools';
import type { Picked } from '../lib/pick';

export type TabParamList = {
  Home: undefined;
  Tools: { cat?: CategoryId | 'all'; focus?: number } | undefined;
  Scanner: undefined;
  Files: { filter?: FileFilter } | undefined;
  Alerts: undefined;
  Settings: undefined;
};

/** A file handed to a tool page, as if chosen with its "Choose files" button. */
export type InjectFile = { path: string; name: string; mime: string };

export type FileFilter = 'all' | 'pdf' | 'image' | 'document' | 'folders';
export type ActivityTab = 'downloaded' | 'opened' | 'processed';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Tool: { id: string };
  /** A tool's own screen in the app (offline engine on the phone, or the processing server). fileIds = files in Fileora, files = files from elsewhere (Share to Fileora). */
  Process: { tool: string; fileIds?: string[]; files?: (InjectFile & { size?: number })[]; /** CI screenshots only: a sample result with n files */ demo?: number };
  /** url, or slugs of a WordPress page (the first one that exists is opened). `tool` = tool id, for downloads. */
  Web: { title: string; url?: string; slugs?: string[]; tool?: string; inject?: InjectFile[] };
  Activity: { tab?: ActivityTab } | undefined;
  /** Scanner editor. images = Scanned Images tab (camera/gallery), convert = Convert PDFs tab. */
  ScanEditor: { mode: 'images' | 'convert'; source?: 'camera' | 'gallery' | 'pdf' | 'images'; docId?: string; pages?: { path: string; mime?: string }[] };
  /** A scanned document's pages. */
  ScanDoc: { id: string };
  /** Images shared to Fileora from another app. */
  Shared: { files: Picked[] };
  RecycleBin: undefined;
  Cloud: undefined;
  Blog: undefined;
  /** App Center → Promotions */
  Promo: undefined;
  /** app 1.2: one alert with its whole message (from Alerts or a tapped notification) */
  Alert: { id: string };
  /** app 1.2.2: Settings → App updates (installed vs latest version) */
  Update: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
