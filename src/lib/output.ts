/** Saves a result: Fileora's folder in the app + a copy in Downloads/Fileora, recorded for Files and Home. */
import BlobUtil from 'react-native-blob-util';
import { DIRS, Folder, mimeOf, publishToDownloads, uniquePath } from '../store/files';
import { FileRec, Source, store } from '../store/store';

export async function saveResult(r: {
  name: string;
  base64?: string;
  fromPath?: string;
  move?: boolean;
  mime?: string;
  tool?: string;
  bytesIn?: number;
  pages?: number;
  source?: Source;
  publish?: boolean;
}): Promise<FileRec> {
  const source: Source = r.source ?? 'processed';
  const folder: Folder = source === 'downloaded' ? 'downloaded' : source === 'processed' ? 'processed' : 'scan';
  const path = await uniquePath(DIRS[folder], r.name);
  if (r.base64 !== undefined) await BlobUtil.fs.writeFile(path, r.base64, 'base64');
  else if (r.fromPath) await (r.move ? BlobUtil.fs.mv(r.fromPath, path) : BlobUtil.fs.cp(r.fromPath, path));
  const name = path.slice(path.lastIndexOf('/') + 1);
  const mime = r.mime ?? mimeOf(name);
  if (r.publish !== false) await publishToDownloads(path, name, mime);
  const rec = await store.addFile({ name, mime, path, source, tool: r.tool, pages: r.pages });
  if (r.tool && source !== 'scan-image') store.logDone(r.tool, r.bytesIn ?? rec.size);
  return rec;
}

/** "report.pdf" + "-numbered" → "report-numbered.pdf" */
export function suffixName(name: string, suffix: string, ext?: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}${suffix}.${ext ?? (dot > 0 ? name.slice(dot + 1) : 'pdf')}`;
}

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
