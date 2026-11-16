/** Android's own file picker (no storage permission). Picked files are copied into the app's cache. */
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';
import { Platform } from 'react-native';
import { mimeOf, stripScheme } from '../store/files';

export type Picked = { key: string; name: string; size: number; path: string; mime: string };
export type Accept = 'pdf' | 'image' | 'jpgpng' | 'pdfimage' | 'heic' | 'svg' | 'html' | 'word' | 'excel' | 'ppt' | 'any';

const IOS = Platform.OS === 'ios';
const T = types as unknown as Record<string, string>;
/* Android takes MIME types; iOS takes UTIs (types.* already gives the right one per system). */
const TYPES: Record<Accept, string[]> = IOS
  ? {
      pdf: [T.pdf],
      image: [T.images],
      jpgpng: ['public.jpeg', 'public.png'],
      pdfimage: [T.pdf, T.images],
      heic: ['public.heic', 'public.heif', T.images],
      svg: ['public.svg-image'],
      html: ['public.html', T.plainText],
      word: [T.doc, T.docx, 'org.oasis-open.opendocument.text', 'public.rtf', T.plainText],
      excel: [T.xls, T.xlsx, 'public.comma-separated-values-text', 'org.oasis-open.opendocument.spreadsheet'],
      ppt: [T.ppt, T.pptx, 'org.openxmlformats.presentationml.slideshow', 'org.oasis-open.opendocument.presentation'],
      any: [T.allFiles],
    }
  : {
      pdf: [T.pdf],
      image: [T.images],
      jpgpng: ['image/jpeg', 'image/png'],
      pdfimage: [T.pdf, T.images],
      heic: ['image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp'],
      svg: ['image/svg+xml'],
      html: ['text/html', T.plainText],
      word: [T.doc, T.docx, 'application/vnd.oasis.opendocument.text', 'application/rtf', 'text/rtf', T.plainText],
      excel: [T.xls, T.xlsx, 'text/csv', 'text/comma-separated-values', 'application/vnd.oasis.opendocument.spreadsheet'],
      ppt: [T.ppt, T.pptx, 'application/vnd.openxmlformats-officedocument.presentationml.slideshow', 'application/vnd.oasis.opendocument.presentation'],
      any: [T.allFiles],
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
