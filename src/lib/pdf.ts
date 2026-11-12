/**
 * PDF work done on the phone with pdf-lib (the file never leaves the device):
 * merge, text watermark, page numbers, photos → PDF, page count.
 */
import BlobUtil from 'react-native-blob-util';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { stripScheme } from '../store/files';

async function load(path: string, name: string): Promise<PDFDocument> {
  const b64 = await BlobUtil.fs.readFile(stripScheme(path), 'base64');
  try {
    return await PDFDocument.load(b64, { updateMetadata: false });
  } catch (e) {
    if (/encrypt/i.test(String(e))) throw new Error(`“${name}” is password-protected. Remove the password first with Unlock PDF.`);
    throw new Error(`“${name}” isn’t a readable PDF.`);
  }
}

async function finish(doc: PDFDocument): Promise<{ base64: string; pages: number }> {
  doc.setProducer('Fileora app');
  doc.setCreator('Fileora (fileora.in)');
  return { base64: await doc.saveAsBase64({ useObjectStreams: true }), pages: doc.getPageCount() };
}

export async function pageCount(path: string, name = 'file'): Promise<number> {
  return (await load(path, name)).getPageCount();
}

export async function mergePdfs(files: { path: string; name: string }[]) {
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await load(f.path, f.name);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p => out.addPage(p));
  }
  return finish(out);
}

export type WatermarkOptions = { text: string; opacity: number; size: number; diagonal: boolean; color: 'gray' | 'red' | 'blue' };
const COLORS = { gray: rgb(0.45, 0.47, 0.5), red: rgb(0.77, 0.17, 0.19), blue: rgb(0, 0.43, 0.99) };

export async function watermarkPdf(file: { path: string; name: string }, o: WatermarkOptions) {
  const doc = await load(file.path, file.name);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.max(8, Math.min(o.size, 200));
    const w = font.widthOfTextAtSize(o.text, size);
    const angle = o.diagonal ? Math.atan2(height, width) : 0;
    // centre the text on the page, also when it is rotated
    const x = width / 2 - (w / 2) * Math.cos(angle) + (size / 3) * Math.sin(angle);
    const y = height / 2 - (w / 2) * Math.sin(angle) - (size / 3) * Math.cos(angle);
    page.drawText(o.text, { x, y, size, font, color: COLORS[o.color], opacity: o.opacity, rotate: degrees((angle * 180) / Math.PI) });
  }
  return finish(doc);
}

export type PageNumberOptions = {
  position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right';
  format: 'n' | 'page-n' | 'n-of-total';
  start: number;
  size: number;
  skipFirst: boolean;
};

export async function numberPages(file: { path: string; name: string }, o: PageNumberOptions) {
  const doc = await load(file.path, file.name);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  pages.forEach((page, i) => {
    if (o.skipFirst && i === 0) return;
    const n = o.start + i - (o.skipFirst ? 1 : 0);
    const last = o.start + total - 1 - (o.skipFirst ? 1 : 0);
    const label = o.format === 'n' ? String(n) : o.format === 'page-n' ? `Page ${n}` : `${n} of ${last}`;
    const { width, height } = page.getSize();
    const w = font.widthOfTextAtSize(label, o.size);
    const margin = 28;
    const x = o.position.endsWith('center') ? (width - w) / 2 : o.position.endsWith('right') ? width - margin - w : margin;
    const y = o.position.startsWith('top') ? height - margin - o.size : margin;
    page.drawText(label, { x, y, size: o.size, font, color: rgb(0.15, 0.17, 0.2) });
  });
  return finish(doc);
}

/** JPG/PNG photos → one PDF, one page per photo at the photo's own size (max A4-ish at 150 dpi). */
export async function imagesToPdf(images: { path: string; mime: string }[]) {
  const doc = await PDFDocument.create();
  for (const img of images) {
    const b64 = await BlobUtil.fs.readFile(stripScheme(img.path), 'base64');
    const embedded = img.mime === 'image/png' ? await doc.embedPng(b64) : await doc.embedJpg(b64);
    // fit inside A4 (595 x 842 pt) keeping proportions
    const scale = Math.min(595 / embedded.width, 842 / embedded.height, 1);
    const w = Math.max(1, embedded.width * scale);
    const h = Math.max(1, embedded.height * scale);
    const page = doc.addPage([w, h]);
    page.drawImage(embedded, { x: 0, y: 0, width: w, height: h });
  }
  return finish(doc);
}
