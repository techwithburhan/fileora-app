/**
 * App 1.2.4: what a file shared to Fileora (Android share sheet) is, and which tools can take it.
 * Pure functions (tested in __tests__/sharedKinds.test.ts).
 */
export type SharedKind = 'image' | 'pdf' | 'word' | 'excel' | 'ppt' | 'other';

const WORD = /(msword|wordprocessingml|opendocument\.text|rtf)/i;
const EXCEL = /(ms-excel|spreadsheetml|opendocument\.spreadsheet|csv|comma-separated)/i;
const PPT = /(ms-powerpoint|presentationml|opendocument\.presentation)/i;

export function sharedKind(mime: string, name = ''): SharedKind {
  const m = (mime || '').toLowerCase();
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (m.startsWith('image/') || /^(jpe?g|png|webp|gif|heic|heif|bmp|avif|svg)$/.test(ext)) return 'image';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (WORD.test(m) || /^(docx?|odt|rtf)$/.test(ext)) return 'word';
  if (EXCEL.test(m) || /^(xlsx?|ods|csv)$/.test(ext)) return 'excel';
  if (PPT.test(m) || /^(pptx?|ppsx|odp)$/.test(ext)) return 'ppt';
  return 'other';
}

/** The converter for an Office file. */
export const CONVERTER: Partial<Record<SharedKind, string>> = { word: 'word2pdf', excel: 'excel2pdf', ppt: 'ppt2pdf' };

/** Tools that take PDFs, most used first ("merge" first when there are two or more). */
export function pdfTools(count: number): string[] {
  const list = [
    'compress', 'split', 'sign', 'pdf2word', 'pdf2jpg', 'organize', 'rotate', 'protect', 'unlock', 'ocr', 'watermark',
    'pagenum', 'crop', 'aadhaar', 'pdf2txt', 'pdf2md', 'pdf2excel', 'pdf2ppt', 'repair', 'pdfa', 'redact', 'forms', 'edit',
    'summarize', 'translate', 'extractimg', 'flatten', 'metadata', 'removeblank', 'resizepages', 'headerfooter', 'bates',
    'nup', 'booklet', 'splithalf', 'pageops', 'invert', 'stamp',
  ];
  return count >= 2 ? ['merge', ...list, 'interleave', 'compare'] : [...list, 'merge'];
}

/**
 * Where a share goes: straight into the converter when every file is the same kind of Office file,
 * otherwise the "Shared to Fileora" screen.
 */
export function shareTarget(files: { mime: string; name: string }[]): { tool: string } | null {
  if (!files.length) return null;
  const kinds = new Set(files.map(f => sharedKind(f.mime, f.name)));
  if (kinds.size !== 1) return null;
  const tool = CONVERTER[[...kinds][0]];
  return tool ? { tool } : null;
}
