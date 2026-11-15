/**
 * Fileora's own folder in the app's storage, plus (Android) a copy of every result in the phone's
 * public Downloads/Fileora (MediaStore; no storage permission on Android 10+).
 * On iOS the files folder shows in the Files app (On My iPhone › Fileora); the app's own data
 * (lists, settings, Recycle Bin) is kept outside it, in DATA, so it can't be removed by mistake.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import BlobUtil from 'react-native-blob-util';

const fs = BlobUtil.fs;
export const ROOT = `${fs.dirs.DocumentDir}/fileora`;
export const DIRS = { downloaded: `${ROOT}/downloads`, processed: `${ROOT}/processed`, scan: `${ROOT}/scans` } as const;
export type Folder = keyof typeof DIRS;
/** The app's own data files (state, settings, queue, Recycle Bin). Android: unchanged since 0.3. */
export const DATA = Platform.OS === 'ios' ? `${fs.dirs.LibraryDir}/fileora` : ROOT;

export async function ensureDirs() {
  for (const d of [ROOT, ...Object.values(DIRS), DATA]) {
    if (!(await fs.isDir(d))) await fs.mkdir(d).catch(() => {});
  }
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  zip: 'application/zip',
  html: 'text/html',
  json: 'application/json',
};

export function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,6})$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}
export function mimeOf(name: string, fallback = 'application/octet-stream'): string {
  return MIME[extOf(name)] ?? fallback;
}

export type Kind = 'pdf' | 'image' | 'document' | 'other';
export function kindOf(mime: string, name = ''): Kind {
  if (mime === 'application/pdf' || extOf(name) === 'pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (/word|excel|spreadsheet|powerpoint|presentation|opendocument|text\/|rtf|csv|json/.test(mime)) return 'document';
  return 'other';
}

export function safeName(n: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = n.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 120);
  return clean || 'fileora-file';
}

/** A free file name in a folder: name.pdf, name (2).pdf, … */
export async function uniquePath(dir: string, name: string): Promise<string> {
  const n = safeName(name);
  const dot = n.lastIndexOf('.');
  const base = dot > 0 ? n.slice(0, dot) : n;
  const ext = dot > 0 ? n.slice(dot) : '';
  let p = `${dir}/${n}`;
  for (let i = 2; await fs.exists(p); i++) p = `${dir}/${base} (${i})${ext}`;
  return p;
}

export const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1);
export const stripScheme = (u: string) => (u.startsWith('file://') ? decodeURI(u.slice(7)) : u);

export async function sizeOf(path: string): Promise<number> {
  try {
    return Number((await fs.stat(path)).size) || 0;
  } catch {
    return 0;
  }
}

/** Where finished files can be found outside the app, in words for the person. */
export const SAVED_WHERE = Platform.OS === 'ios' ? 'the Files app (On My iPhone › Fileora)' : 'Downloads/Fileora';

/**
 * Android: copies a finished file into Downloads/Fileora so it is visible in the phone's Files app.
 * iOS: nothing to copy, Fileora's own folder already shows in the Files app (On My iPhone › Fileora).
 */
export async function publishToDownloads(path: string, name: string, mime: string): Promise<boolean> {
  if (Platform.OS === 'ios') return true;
  try {
    if (Platform.OS === 'android' && Number(Platform.Version) < 29) {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
      if (r !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }
    await BlobUtil.media.copyToMediaStore({ name, parentFolder: 'Fileora', mimeType: mime }, 'Download', path);
    return true;
  } catch {
    return false;
  }
}

/** Opens a file with the phone's viewer for its type (iOS: preview, with the share button to open it elsewhere). */
export async function openWithViewer(path: string, mime: string): Promise<void> {
  if (Platform.OS === 'ios') {
    await BlobUtil.ios.previewDocument(path);
    return;
  }
  await BlobUtil.android.actionViewIntent(path, mime);
}

export function formatBytes(b: number): string {
  if (!b) return '0 KB';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}

export function formatDate(t: number): string {
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
