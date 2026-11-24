/**
 * Receives files from the web pages (see webBridge.ts): pieces are appended to a file in the
 * cache, then the file is saved in Fileora's folder (listed under Files → Downloaded) and copied
 * to the phone's Downloads/Fileora.
 */
import Alert from '../i18n/Alert';
import BlobUtil from 'react-native-blob-util';
import { openWithViewer, safeName, SAVED_WHERE } from '../store/files';
import { store } from '../store/store';
import { saveResult } from './output';
import { telemetry } from '../remote/telemetry';
import { busy } from './busy';
import { tr } from '../i18n/i18n';

type Pending = { name: string; mime: string; path: string; chain: Promise<unknown>; done: () => void };
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
    pending.set(msg.id, { name, mime: msg.mime, path, chain: fs.writeFile(path, '', 'utf8'), done: busy.start() });
    return;
  }
  const p = pending.get(msg.id);
  if (msg.type === 'dl-error') {
    if (p) {
      pending.delete(msg.id);
      p.done();
    }
    telemetry.track('failed', tool, 0, 'download failed in the page');
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
      Alert.alert('Your file is ready', `${rec.name}\n${tr('Saved in Files and in {where}.', { where: tr(SAVED_WHERE) })}`, [
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
    .catch(e => {
      telemetry.track('failed', tool, 0, `download not saved: ${e instanceof Error ? e.message : String(e)}`);
      Alert.alert('Download failed', 'The file could not be saved.');
    })
    .finally(p.done);
}

/**
 * Several results (app 1.1.1, same rule as the website 2.21): 1 or 2 files are saved straight to
 * Downloads; 3 or more are saved to Downloads as one ZIP (several ZIP files of at most 100 files
 * for very large batches) and kept one by one in the app (Downloads → Processed).
 */
export const ZIP_FROM = 3;
