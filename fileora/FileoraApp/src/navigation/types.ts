import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CategoryId } from '../data/tools';

export type TabParamList = {
  Home: undefined;
  Tools: { cat?: CategoryId | 'all'; focus?: number } | undefined;
  Resume: undefined;
  Blog: undefined;
  Contact: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Tool: { id: string };
  /** url, or slugs of a WordPress page (the first one that exists is opened). */
  Web: { title: string; url?: string; slugs?: string[] };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
