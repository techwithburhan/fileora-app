/**
 * Receives files from the web pages (see webBridge.ts) and saves them in Downloads/Fileora.
 * Pieces are appended to a file in the app's cache, then copied into the public Downloads folder
 * with Android's MediaStore (no storage permission needed on Android 10+).
 */
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import BlobUtil from 'react-native-blob-util';

type Pending = { name: string; mime: string; path: string; chain: Promise<unknown> };
const pending = new Map<string, Pending>();

function safeName(n: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = n.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120);
  return clean || 'fileora-download';
}

export type DownloadMessage =
  | { type: 'dl-start'; id: string; name: string; mime: string; size: number }
  | { type: 'dl-chunk'; id: string; data: string }
  | { type: 'dl-end'; id: string }
  | { type: 'dl-error'; id: string };

export function handleDownloadMessage(msg: DownloadMessage, onSaved?: (name: string) => void) {
  const fs = BlobUtil.fs;
  if (msg.type === 'dl-start') {
    const name = safeName(msg.name);
    const path = `${fs.dirs.CacheDir}/dl-${msg.id}-${name}`;
    pending.set(msg.id, { name, mime: msg.mime, path, chain: fs.writeFile(path, '', 'utf8') });
    return;
  }
  const p = pending.get(msg.id);
  if (msg.type === 'dl-error') {
    if (p) pending.delete(msg.id);
    Alert.alert('Download failed', 'The file could not be saved. Please try again.');
    return;
  }
  if (!p) return;
  if (msg.type === 'dl-chunk') {
    p.chain = p.chain.then(() => fs.appendFile(p.path, msg.data, 'base64'));
    return;
  }
  // dl-end
  pending.delete(msg.id);
  p.chain
    .then(async () => {
      // Android 7–9: the public Downloads folder needs the storage permission.
      if (Platform.OS === 'android' && Number(Platform.Version) < 29) {
        const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        if (r !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('permission');
      }
    })
    .then(() => BlobUtil.media.copyToMediaStore({ name: p.name, parentFolder: 'Fileora', mimeType: p.mime }, 'Download', p.path))
    .then(() => {
      onSaved?.(p.name);
      Alert.alert('Saved', `${p.name}\nis in Downloads/Fileora.`, [
        { text: 'OK', style: 'cancel', onPress: () => fs.unlink(p.path).catch(() => {}) },
        { text: 'Open', onPress: () => BlobUtil.open.file(p.path, { mime: p.mime }).catch(() => Alert.alert('No app can open this file type.')) },
      ]);
    })
    .catch(() => Alert.alert('Download failed', 'The file could not be saved in Downloads.'));
}
