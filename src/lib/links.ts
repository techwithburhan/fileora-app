/**
 * Links: a fileora.in tool page opens the tool's own screen in the app; other fileora.in pages
 * (blog, privacy, contact…) open inside the app; everything else in the browser or mail app.
 */
import { Linking } from 'react-native';
import { SITE_HOSTS } from '../config';
import { TOOLS } from '../data/tools';
import { navigationRef } from '../navigation/types';

export function isSiteLink(url: string) {
  try {
    return SITE_HOSTS.includes(new URL(url).host.toLowerCase());
  } catch {
    return false;
  }
}

/** The tool a fileora.in address points to (https://www.fileora.in/merge-pdf/ → merge), if any. */
export function toolForUrl(url: string): string | null {
  if (!isSiteLink(url)) return null;
  try {
    const slug = new URL(url).pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    return TOOLS.find(t => t.slug === slug)?.id ?? null;
  } catch {
    return null;
  }
}

export function openLink(url: string, title = 'Fileora') {
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) return;
  const tool = toolForUrl(url);
  if (tool && navigationRef.isReady()) navigationRef.navigate('Tool', { id: tool });
  else if (isSiteLink(url) && navigationRef.isReady()) navigationRef.navigate('Web', { url, title });
  else Linking.openURL(url).catch(() => {});
}
