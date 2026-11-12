/**
 * Receives files from the web pages (see webBridge.ts): pieces are appended to a file in the
 * cache, then the file is saved in Fileora's folder (listed under Files → Downloaded) and copied
 * to the phone's Downloads/Fileora.
 */
import { Alert } from 'react-native';
import BlobUtil from 'react-native-blob-util';
import { openWithViewer, safeName } from '../store/files';
import { store } from '../store/store';
import { saveResult } from './output';

type Pending = { name: string; mime: string; path: string; chain: Promise<unknown> };
const pending = new Map<string, Pending>();

export type DownloadMessage =
  | { type: 'dl-start'; id: string; name: string; mime: string; size: number }
  | { type: 'dl-chunk'; id: string; data: string }
  | { type: 'dl-end'; id: string }
  | { type: 'dl-error'; id: string };

/** tool: the Fileora tool whose page made the file (counts as a finished task). */
export function handleDownloadMessage(msg: DownloadMessage, tool?: string) {
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
  pending.delete(msg.id);
  p.chain
    .then(() => saveResult({ name: p.name, fromPath: p.path, move: true, mime: p.mime === 'application/octet-stream' ? undefined : p.mime, tool, source: 'downloaded' }))
    .then(rec => {
      Alert.alert('Your file is ready', `${rec.name}\nSaved in Files and in Downloads/Fileora.`, [
        { text: 'OK', style: 'cancel' },
        {
          text: 'Open',
          onPress: () => {
            store.markOpened(rec.id);
            openWithViewer(rec.path, rec.mime).catch(() => Alert.alert('No app on this phone can open this file type.'));
          },
        },
      ]);
    })
    .catch(() => Alert.alert('Download failed', 'The file could not be saved.'));
}
