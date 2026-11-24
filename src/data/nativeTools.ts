/**
 * Every Fileora tool has its own screen in the app (ProcessScreen); none opens the website.
 *  - on the phone: the offline engine (the website's own tool code, bundled in the app)
 *  - API tools: the Fileora processing server (your VPS), when App Center says it is live
 * Edit PDF is still "pending" on the website, so it is listed as coming soon.
 */
import { isAvailable, toolById } from './tools';

export const isNative = (id: string) => {
  const t = toolById(id);
  return !!t && !t.pending;
};

/** What to suggest after a task ("Keep going with this file"). */
export function relatedFor(toolId: string, mime: string): string[] {
  return related(toolId, mime).filter(id => {
    const t = toolById(id);
    return !!t && isAvailable(t);
  });
}
function related(toolId: string, mime: string): string[] {
  if (toolId === 'merge') return ['compress', 'sign', 'watermark', 'pagenum'];
  if (mime === 'application/pdf') {
    const base = ['compress', 'watermark', 'pagenum', 'merge', 'sign', 'protect', 'split', 'ocr'];
    return base.filter(t => t !== toolId).slice(0, 4);
  }
  if (/^image\/(jpe?g|png|webp)$/.test(mime)) return ['imgcompress', 'imgkb', 'imgresize', 'imgcrop', 'jpg2pdf'].filter(t => t !== toolId).slice(0, 4);
  if (/wordprocessing|msword/.test(mime)) return ['word2pdf'];
  if (/spreadsheet|ms-excel/.test(mime)) return ['excel2pdf'];
  if (/presentation|powerpoint/.test(mime)) return ['ppt2pdf'];
  return [];
}
