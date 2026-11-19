/**
 * App languages (app 1.1): English, Hindi, Spanish, French, German, Urdu, Arabic, Punjabi, Russian,
 * Portuguese. Chosen from the language button in the top bar; until then the phone's language is
 * used when Fileora has it, otherwise English.
 *
 * The English text is the key: tr('Merge PDF') returns the translation or the English text. Most
 * screens need no code at all: the app's <Text> (src/i18n/Text.tsx) translates plain strings by
 * itself, including tool names, descriptions and options from the engine. Text with values in it
 * uses placeholders: tr('{n} files', { n: 3 }).
 *
 * Urdu and Arabic are right-to-left: the layout is mirrored at once (root `direction`), and the
 * system's own right-to-left mode (navigation animations, text alignment on iOS) takes effect the
 * next time the app starts.
 *
 * Translations are machine-written by the developer and should be reviewed by native speakers.
 */
import { I18nManager } from 'react-native';
import { store, useStore } from '../store/store';
import { DICTS } from './locales';

export type LangCode = 'en' | 'hi' | 'es' | 'fr' | 'de' | 'ur' | 'ar' | 'pa' | 'ru' | 'pt';
export type Lang = { code: LangCode; name: string; native: string; short: string; rtl: boolean };

export const LANGS: Lang[] = [
  { code: 'en', name: 'English', native: 'English', short: 'EN', rtl: false },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', short: 'हि', rtl: false },
  { code: 'es', name: 'Spanish', native: 'Español', short: 'ES', rtl: false },
  { code: 'fr', name: 'French', native: 'Français', short: 'FR', rtl: false },
  { code: 'de', name: 'German', native: 'Deutsch', short: 'DE', rtl: false },
  { code: 'ur', name: 'Urdu', native: 'اردو', short: 'اُر', rtl: true },
  { code: 'ar', name: 'Arabic', native: 'العربية', short: 'ع', rtl: true },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', short: 'ਪੰ', rtl: false },
  { code: 'ru', name: 'Russian', native: 'Русский', short: 'RU', rtl: false },
  { code: 'pt', name: 'Portuguese', native: 'Português', short: 'PT', rtl: false },
];

const CODES = LANGS.map(l => l.code) as string[];

/** The phone's first language that Fileora has, else English. */
export function deviceLang(): LangCode {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
    const code = loc.toLowerCase().split(/[-_]/)[0];
    return (CODES.includes(code) ? code : 'en') as LangCode;
  } catch {
    return 'en';
  }
}

export function currentLang(): LangCode {
  const chosen = store.get().lang;
  return (CODES.includes(chosen) ? chosen : deviceLang()) as LangCode;
}

export function langInfo(code: LangCode = currentLang()): Lang {
  return LANGS.find(l => l.code === code) ?? LANGS[0];
}

export function isRtl(code: LangCode = currentLang()): boolean {
  return langInfo(code).rtl;
}

function fill(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** The translation of an English text (with {placeholders} filled), or the English text. */
export function tr(en: string, params?: Record<string, string | number>): string {
  if (!en) return en;
  const code = currentLang();
  if (code === 'en') return fill(en, params);
  const d = DICTS[code];
  const hit = d?.[en];
  if (hit) return fill(hit, params);
  // keep leading/trailing spaces of fragments such as "Saved in "
  const t = en.trim();
  if (t !== en && d?.[t]) return en.replace(t, fill(d[t], params));
  return fill(en, params);
}

/** Only translates when the text is a known UI string (used for text that may also be a file name). */
export function trKnown(s: string): string {
  return tr(s);
}

/** Re-renders the component when the language changes; returns tr for convenience. */
export function useLang(): { lang: LangCode; tr: typeof tr; rtl: boolean } {
  const chosen = useStore(s => s.lang);
  const code = (CODES.includes(chosen) ? chosen : deviceLang()) as LangCode;
  return { lang: code, tr, rtl: langInfo(code).rtl };
}

/**
 * Switches the language. Returns true when the system's right-to-left mode will change at the next
 * start (the layout itself is mirrored at once).
 */
export function setLang(code: LangCode): boolean {
  store.setLang(code);
  const rtl = langInfo(code).rtl;
  try {
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== rtl) {
      I18nManager.forceRTL(rtl);
      return true;
    }
  } catch {
    // not available (tests): the root direction still mirrors the layout
  }
  return false;
}

/** At start: keep the system's right-to-left mode in line with the saved language. */
export function syncRtl() {
  try {
    I18nManager.allowRTL(true);
    const rtl = isRtl();
    if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
  } catch {
    // ignore
  }
}

/** Numbers in the person's language (digits stay Western for Urdu/Arabic/Hindi, as most apps do). */
export function num(n: number): string {
  try {
    return new Intl.NumberFormat(currentLang() === 'en' ? 'en-IN' : `${currentLang()}-u-nu-latn`).format(n);
  } catch {
    return String(n);
  }
}
