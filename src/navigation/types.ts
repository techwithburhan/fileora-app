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

export type FileFilter = 'all' | 'pdf' | 'image' | 'document' | 'folders';
export type ActivityTab = 'downloaded' | 'opened' | 'processed';

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Tool: { id: string };
  /** A tool that works natively in the app (on the phone or through the Fileora server API). */
  Process: { tool: string; fileIds?: string[] };
  /** url, or slugs of a WordPress page (the first one that exists is opened). `tool` = tool id, for downloads. */
  Web: { title: string; url?: string; slugs?: string[]; tool?: string };
  Activity: { tab?: ActivityTab } | undefined;
  /** Photos picked from the gallery, to review and turn into a PDF. */
  ScanReview: { images: Picked[] };
  Blog: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
