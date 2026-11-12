import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CategoryId } from '../data/tools';
import type { Picked } from '../lib/pick';

export type TabParamList = {
  Home: undefined;
  Tools: { cat?: CategoryId | 'all'; focus?: number } | undefined;
  Scanner: undefined;
  Files: { filter?: FileFilter } | undefined;
  Resume: undefined;
  Settings: undefined;
};

/** A file handed to a tool page, as if chosen with its "Choose files" button. */
export type InjectFile = { path: string; name: string; mime: string };

export type FileFilter = 'all' | 'pdf' | 'image' | 'document' | 'folders';
export type ActivityTab = 'downloaded' | 'opened' | 'processed';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Tool: { id: string };
  /** A tool that works natively in the app (on the phone or through the Fileora server API). */
  Process: { tool: string; fileIds?: string[] };
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
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
