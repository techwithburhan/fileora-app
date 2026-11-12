/**
 * Scanning with Google's ML Kit document scanner (runs in Google Play services, so the app needs
 * no camera permission): edge detection, crop & rotate, filters, clean, retake, add pages and
 * import from the gallery all happen inside the scanner. The pages come back as JPGs plus a PDF.
 */
import { launchScanner } from '@dariyd/react-native-document-scanner';
import { imagesToPdf } from './pdf';
import { saveResult, stamp } from './output';
import { stripScheme } from '../store/files';
import { FileRec } from '../store/store';

export const SCAN_PAGE_LIMIT = 30;

/** Returns the saved PDF, or null when the person closed the scanner. */
export async function scanWithCamera(): Promise<FileRec | null> {
  const r = await launchScanner({ scannerMode: 'full', galleryImportAllowed: true, includePdf: true, pageLimit: SCAN_PAGE_LIMIT, quality: 0.9 });
  if (r.didCancel) return null;
  if (r.error) throw new Error(r.errorMessage || 'The scanner couldn’t start. It needs Google Play services.');
  const images = r.images ?? [];
  if (!images.length) return null;
  const base = `scan-${stamp()}`;
  let bytesIn = 0;
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    bytesIn += img.fileSize || 0;
    await saveResult({ name: `${base}-${i + 1}.jpg`, fromPath: stripScheme(img.uri), mime: img.type || 'image/jpeg', source: 'scan-image', publish: false });
  }
  if (r.pdf) {
    return saveResult({ name: `${base}.pdf`, fromPath: stripScheme(r.pdf.uri), move: true, mime: 'application/pdf', source: 'scan', tool: 'scan', bytesIn, pages: r.pdf.pageCount });
  }
  return makePdf(images.map(i => ({ path: stripScheme(i.uri), mime: i.type || 'image/jpeg', size: i.fileSize })), base);
}

/** Images (JPG/PNG) → one PDF, one page per image, in this order. */
export async function makePdf(images: { path: string; mime: string; size?: number }[], base = `scan-${stamp()}`): Promise<FileRec> {
  const r = await imagesToPdf(images);
  const bytesIn = images.reduce((s, i) => s + (i.size || 0), 0);
  return saveResult({ name: `${base}.pdf`, base64: r.base64, mime: 'application/pdf', source: 'scan', tool: 'scan', bytesIn, pages: r.pages });
}
