/**
 * Cloud storage connections. Fileora connects through each service's own Android app on the phone
 * (the account signed in there): files are uploaded with the app's "send to" screen and opened from
 * Android's file picker, where Drive and OneDrive appear. No passwords or keys are kept by Fileora.
 */
import type { CloudId } from '../store/store';

export type Cloud = { id: CloudId; name: string; pkg: string; desc: string };

export const CLOUDS: Cloud[] = [
  { id: 'gdrive', name: 'Google Drive', pkg: 'com.google.android.apps.docs', desc: 'Connect your Google Drive account' },
  { id: 'jiocloud', name: 'JioCloud', pkg: 'jio.cloud.drive', desc: 'Connect your JioCloud account' },
  { id: 'onedrive', name: 'OneDrive', pkg: 'com.microsoft.skydrive', desc: 'Connect your OneDrive account' },
];

export const playStoreUrl = (pkg: string) => `https://play.google.com/store/apps/details?id=${pkg}`;
