/** Links: fileora.in pages open inside the app, everything else in the browser or mail app. */
import { Linking } from 'react-native';
import { SITE_HOSTS } from '../config';
import { navigationRef } from '../navigation/types';

export function isSiteLink(url: string) {
  try {
    return SITE_HOSTS.includes(new URL(url).host.toLowerCase());
  } catch {
    return false;
  }
}

export function openLink(url: string, title = 'Fileora') {
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) return;
  if (isSiteLink(url) && navigationRef.isReady()) navigationRef.navigate('Web', { url, title });
  else Linking.openURL(url).catch(() => {});
}
