/** Android's own file picker (no storage permission). Picked files are copied into the app's cache. */
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';
import { mimeOf, stripScheme } from '../store/files';

export type Picked = { key: string; name: string; size: number; path: string; mime: string };
export type Accept = 'pdf' | 'image' | 'jpgpng' | 'word' | 'excel' | 'ppt' | 'any';

const TYPES: Record<Accept, string[]> = {
  pdf: [types.pdf as string],
  image: [types.images as string],
  jpgpng: ['image/jpeg', 'image/png'],
  word: [types.doc as string, types.docx as string, 'application/vnd.oasis.opendocument.text', 'application/rtf', 'text/rtf'],
  excel: [types.xls as string, types.xlsx as string, 'text/csv', 'application/vnd.oasis.opendocument.spreadsheet'],
  ppt: [types.ppt as string, types.pptx as string, 'application/vnd.oasis.opendocument.presentation'],
  any: [types.allFiles as string],
};

let n = 0;

/** Returns [] when the person closes the picker. */
export async function pickFiles(accept: Accept, multiple: boolean): Promise<Picked[]> {
  let res;
  try {
    res = await pick({ type: TYPES[accept], allowMultiSelection: multiple, mode: 'import' });
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return [];
    throw e;
  }
  const files = res.map(f => ({ uri: f.uri, fileName: f.name ?? `file-${Date.now()}` }));
  const copies = await keepLocalCopy({ files: files as [(typeof files)[0], ...typeof files], destination: 'cachesDirectory' });
  const out: Picked[] = [];
  copies.forEach((c, i) => {
    if (c.status !== 'success') return;
    const f = res[i];
    const name = f.name ?? files[i].fileName;
    out.push({ key: `p${++n}-${Date.now()}`, name, size: f.size ?? 0, path: stripScheme(c.localUri), mime: f.type ?? mimeOf(name) });
  });
  return out;
}
