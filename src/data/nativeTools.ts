/**
 * Tools that work natively in the app. Others open their fileora.in page inside the app.
 *  - device: done on the phone with pdf-lib (merge, watermark, page numbers)
 *  - server: sent to the Fileora server through the website's REST API (same as the website)
 */
import type { Accept } from '../lib/pick';
import { API_TOOLS_LIVE } from '../config';
import { isAvailable, toolById } from './tools';

export type Choice = { value: string; label: string };
export type OptionDef =
  | { key: string; type: 'choice'; label: string; choices: Choice[]; default: string }
  | { key: string; type: 'text'; label: string; placeholder?: string; secret?: boolean; required?: boolean; default: string }
  | { key: string; type: 'toggle'; label: string; default: boolean };

export type NativeTool = {
  kind: 'merge' | 'watermark' | 'pagenum' | 'server';
  accept: Accept;
  /** files at a time (1 = single) */
  max: number;
  min: number;
  action: string;
  options?: OptionDef[];
};

const LANGS: Choice[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'ur', label: 'Urdu' },
];

export const NATIVE: Record<string, NativeTool> = {
  merge: { kind: 'merge', accept: 'pdf', max: 50, min: 2, action: 'Merge' },
  watermark: {
    kind: 'watermark',
    accept: 'pdf',
    max: 1,
    min: 1,
    action: 'Add watermark',
    options: [
      { key: 'text', type: 'text', label: 'Watermark text', placeholder: 'CONFIDENTIAL', required: true, default: 'CONFIDENTIAL' },
      { key: 'size', type: 'choice', label: 'Size', choices: [{ value: '36', label: 'Small' }, { value: '60', label: 'Medium' }, { value: '90', label: 'Large' }], default: '60' },
      { key: 'opacity', type: 'choice', label: 'Strength', choices: [{ value: '0.15', label: 'Light' }, { value: '0.3', label: 'Normal' }, { value: '0.5', label: 'Strong' }], default: '0.3' },
      { key: 'color', type: 'choice', label: 'Colour', choices: [{ value: 'gray', label: 'Grey' }, { value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }], default: 'gray' },
      { key: 'diagonal', type: 'toggle', label: 'Diagonal across the page', default: true },
    ],
  },
  pagenum: {
    kind: 'pagenum',
    accept: 'pdf',
    max: 1,
    min: 1,
    action: 'Add page numbers',
    options: [
      {
        key: 'position',
        type: 'choice',
        label: 'Position',
        choices: [
          { value: 'bottom-center', label: 'Bottom centre' },
          { value: 'bottom-right', label: 'Bottom right' },
          { value: 'bottom-left', label: 'Bottom left' },
          { value: 'top-center', label: 'Top centre' },
          { value: 'top-right', label: 'Top right' },
        ],
        default: 'bottom-center',
      },
      { key: 'format', type: 'choice', label: 'Format', choices: [{ value: 'n', label: '1' }, { value: 'page-n', label: 'Page 1' }, { value: 'n-of-total', label: '1 of 9' }], default: 'n' },
      { key: 'start', type: 'text', label: 'First number', placeholder: '1', default: '1' },
      { key: 'skipFirst', type: 'toggle', label: 'No number on the first page (cover)', default: false },
    ],
  },
  compress: {
    kind: 'server',
    accept: 'pdf',
    max: 20,
    min: 1,
    action: 'Compress',
    options: [{ key: 'level', type: 'choice', label: 'Compression', choices: [{ value: 'light', label: 'Light (best quality)' }, { value: 'balanced', label: 'Balanced' }, { value: 'strong', label: 'Strong (smallest)' }], default: 'balanced' }],
  },
  word2pdf: { kind: 'server', accept: 'word', max: 20, min: 1, action: 'Convert to PDF' },
  excel2pdf: { kind: 'server', accept: 'excel', max: 20, min: 1, action: 'Convert to PDF', options: [{ key: 'fit', type: 'toggle', label: 'Fit each sheet to the page width', default: true }] },
  ppt2pdf: { kind: 'server', accept: 'ppt', max: 20, min: 1, action: 'Convert to PDF', options: [{ key: 'notes', type: 'toggle', label: 'Include speaker notes', default: false }] },
  pdf2word: { kind: 'server', accept: 'pdf', max: 10, min: 1, action: 'Convert to Word', options: [{ key: 'ocr', type: 'toggle', label: 'Read scanned pages (OCR)', default: true }] },
  pdf2excel: { kind: 'server', accept: 'pdf', max: 10, min: 1, action: 'Convert to Excel' },
  pdf2ppt: { kind: 'server', accept: 'pdf', max: 10, min: 1, action: 'Convert to PowerPoint' },
  ocr: {
    kind: 'server',
    accept: 'pdf',
    max: 10,
    min: 1,
    action: 'Make searchable',
    options: [
      { key: 'lang', type: 'choice', label: 'Language of the text', choices: LANGS, default: 'en' },
      { key: 'out', type: 'choice', label: 'Result', choices: [{ value: 'pdf', label: 'Searchable PDF' }, { value: 'txt', label: 'Text file' }], default: 'pdf' },
    ],
  },
  pdfa: { kind: 'server', accept: 'pdf', max: 10, min: 1, action: 'Convert to PDF/A' },
  repair: { kind: 'server', accept: 'pdf', max: 1, min: 1, action: 'Repair' },
  protect: {
    kind: 'server',
    accept: 'pdf',
    max: 20,
    min: 1,
    action: 'Protect',
    options: [
      { key: 'pw', type: 'text', label: 'New password', placeholder: 'At least 4 characters', secret: true, required: true, default: '' },
      { key: 'noprint', type: 'toggle', label: 'Don’t allow printing', default: false },
    ],
  },
  unlock: {
    kind: 'server',
    accept: 'pdf',
    max: 20,
    min: 1,
    action: 'Unlock',
    options: [{ key: 'pw', type: 'text', label: 'Current password', secret: true, required: true, default: '' }],
  },
};

/** Runs natively in the app: on the phone always; through the server API only when it is live. */
export const isNative = (id: string) => id in NATIVE && (NATIVE[id].kind !== 'server' || API_TOOLS_LIVE);

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
    const base = ['compress', 'watermark', 'pagenum', 'merge', 'sign', 'protect', 'ocr'];
    return base.filter(t => t !== toolId).slice(0, 4);
  }
  if (/wordprocessing|msword/.test(mime)) return ['word2pdf'];
  if (/spreadsheet|ms-excel/.test(mime)) return ['excel2pdf'];
  if (/presentation|powerpoint/.test(mime)) return ['ppt2pdf'];
  return [];
}
