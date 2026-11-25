import { pdfTools, sharedKind, shareTarget } from '../src/lib/sharedKinds';
import { TOOLS } from '../src/data/tools';

// the tool list reads App Center settings at run time; not needed for the ids
jest.mock('../src/remote/remote', () => ({ apiLive: () => true, remote: { get: () => ({ config: null }) } }));
const TOOL_IDS = new Set(TOOLS.map(t => t.id));

describe('files shared to Fileora (Android share sheet)', () => {
  test('kinds from the type the sender gives, or from the extension', () => {
    expect(sharedKind('application/pdf', 'a.pdf')).toBe('pdf');
    expect(sharedKind('', 'Scan201620Nov-ocr.PDF')).toBe('pdf');
    expect(sharedKind('image/jpeg', 'IMG-1.jpg')).toBe('image');
    expect(sharedKind('image/gif', 'x.gif')).toBe('image');
    expect(sharedKind('image/webp', 'x.webp')).toBe('image');
    expect(sharedKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'cv.docx')).toBe('word');
    expect(sharedKind('application/msword', 'old.doc')).toBe('word');
    expect(sharedKind('application/vnd.ms-excel', 'sheet.xls')).toBe('excel');
    expect(sharedKind('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'sheet.xlsx')).toBe('excel');
    expect(sharedKind('text/csv', 'list.csv')).toBe('excel');
    expect(sharedKind('application/vnd.ms-powerpoint', 'deck.ppt')).toBe('ppt');
    expect(sharedKind('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'deck.pptx')).toBe('ppt');
    expect(sharedKind('application/zip', 'a.zip')).toBe('other');
  });
  test('Office files go straight to their converter; PDFs, photos and mixes to the choice screen', () => {
    expect(shareTarget([{ mime: 'application/msword', name: 'a.doc' }])).toEqual({ tool: 'word2pdf' });
    expect(shareTarget([{ mime: '', name: 'a.xlsx' }, { mime: 'application/vnd.ms-excel', name: 'b.xls' }])).toEqual({ tool: 'excel2pdf' });
    expect(shareTarget([{ mime: 'application/vnd.ms-powerpoint', name: 'a.ppt' }])).toEqual({ tool: 'ppt2pdf' });
    expect(shareTarget([{ mime: 'application/pdf', name: 'a.pdf' }])).toBeNull();
    expect(shareTarget([{ mime: 'image/png', name: 'a.png' }])).toBeNull();
    expect(shareTarget([{ mime: 'application/msword', name: 'a.doc' }, { mime: 'application/pdf', name: 'b.pdf' }])).toBeNull();
    expect(shareTarget([])).toBeNull();
  });
  test('every PDF tool offered exists, merge comes first only for two or more PDFs', () => {
    expect(TOOL_IDS.size).toBeGreaterThan(70);
    for (const id of pdfTools(2)) expect(TOOL_IDS.has(id)).toBe(true);
    for (const id of ['word2pdf', 'excel2pdf', 'ppt2pdf']) expect(TOOL_IDS.has(id)).toBe(true);
    expect(pdfTools(2)[0]).toBe('merge');
    expect(pdfTools(1)[0]).toBe('compress');
    expect(new Set(pdfTools(1)).size).toBe(pdfTools(1).length);
  });
});
