/**
 * App languages: every translation keeps the {placeholders} of its English text, and tr() falls
 * back to English for anything not translated.
 */
let mockLang = 'en';
jest.mock('../src/store/store', () => ({
  store: { get: () => ({ lang: mockLang }), set: () => {} },
  useStore: (sel: (s: { lang: string }) => unknown) => sel({ lang: mockLang }),
}));
jest.mock('react-native', () => ({ I18nManager: { isRTL: false, allowRTL: () => {}, forceRTL: () => {} } }));

import { DICTS } from '../src/i18n/locales';
import { tr, trMsg, isRtl, LANGS } from '../src/i18n/i18n';

const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('translations', () => {
  it('has a dictionary for every non-English language', () => {
    for (const l of LANGS) if (l.code !== 'en') expect(Object.keys(DICTS[l.code] ?? {}).length).toBeGreaterThan(1000);
  });

  it('keeps every placeholder', () => {
    for (const [code, dict] of Object.entries(DICTS)) {
      for (const [en, t] of Object.entries(dict)) {
        if (holes(en) !== holes(t)) throw new Error(`${code}: "${en}" → "${t}"`);
      }
    }
  });

  it('translates, fills values and falls back to English', () => {
    mockLang = 'hi';
    expect(tr('Settings')).toBe(DICTS.hi.Settings);
    expect(tr('{n} files saved', { n: 3 })).toContain('3');
    expect(tr('A text nobody translated')).toBe('A text nobody translated');
    mockLang = 'en';
    expect(tr('{n} files saved', { n: 2 })).toBe('2 files saved');
  });

  it('translates engine sentences built from pieces', () => {
    mockLang = 'es';
    expect(trMsg('Add at least 2 PDF files to start.')).toBe('Añade al menos 2 archivos PDF para empezar.');
    expect(trMsg('Add a PDF to start.')).toBe('Añade un PDF para empezar.');
    expect(trMsg('Something new from the engine.')).toBe('Something new from the engine.');
    mockLang = 'en';
    expect(trMsg('Add a PDF to start.')).toBe('Add a PDF to start.');
  });

  it('mirrors the layout for Urdu and Arabic only', () => {
    expect(isRtl('ur')).toBe(true);
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('hi')).toBe(false);
  });
});
