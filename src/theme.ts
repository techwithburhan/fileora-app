import { useColorScheme } from 'react-native';
import type { CategoryId } from './data/tools';
import { useStore } from './store/store';

/** Fileora brand colours (same as the website). */
export const brand = {
  green: '#17AF64',
  greenDark: '#169D72',
  navy: '#04336B',
  blue: '#006DFC',
  blueDark: '#0054C8',
};

export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  ink: string;
  ink2: string;
  muted: string;
  accent: string;
  onAccent: string;
  link: string;
  header: string;
  danger: string;
  /** green text/icons that pass contrast on this background */
  accentInk: string;
  /** maintenance / warning notes */
  warnBg: string;
  warnLine: string;
  warnInk: string;
};

const light: Theme = {
  dark: false,
  bg: '#F4F7FB',
  surface: '#FFFFFF',
  surface2: '#EAF0F7',
  line: '#DCE4EE',
  ink: brand.navy,
  ink2: '#26466F',
  muted: '#4A6185',
  accent: brand.green,
  onAccent: '#03213F',
  link: '#0062E3',
  header: '#FFFFFF',
  danger: '#C42B31',
  accentInk: '#0F7F49',
  warnBg: '#FFF6E0',
  warnLine: '#F2D58A',
  warnInk: '#8A5A00',
};

const dark: Theme = {
  dark: true,
  bg: '#061223',
  surface: '#0C1E36',
  surface2: '#122A48',
  line: '#1E3A5F',
  ink: '#EAF2FF',
  ink2: '#C7D6EC',
  muted: '#93A9C9',
  accent: '#3CC680',
  onAccent: '#03213F',
  link: '#6AA8FF',
  header: '#0A1A30',
  danger: '#FF8A8D',
  accentInk: '#3CC680',
  warnBg: '#3A2A0B',
  warnLine: '#7A5A12',
  warnInk: '#F5C451',
};

/** Light or dark: the user's choice in Settings, otherwise the phone's setting. */
export function useTheme(): Theme {
  const system = useColorScheme();
  const pref = useStore(s => s.theme);
  const isDark = pref === 'system' ? system === 'dark' : pref === 'dark';
  return isDark ? dark : light;
}

const CAT: Record<CategoryId, [string, string]> = {
  // [light, dark]
  pdf: [brand.blue, '#5CA0FF'],
  image: [brand.green, '#3CC680'],
  converter: ['#C96A00', '#F5A23A'],
  optimizer: ['#0E8F86', '#3CCFC4'],
  security: [brand.navy, '#8FB8FF'],
  editor: ['#6D3FD6', '#B497FF'],
  ai: ['#C2357A', '#FF8CC4'],
};

export function catColor(cat: CategoryId, theme: Theme): string {
  return CAT[cat][theme.dark ? 1 : 0];
}

/**
 * Chart colours per category (fixed order). Checked with the dataviz palette validator against
 * the light (#FFFFFF) and dark (#0C1E36) card colours: lightness band, chroma, colour-blind
 * separation of neighbours, normal-vision separation and 3:1 contrast all pass.
 */
const CHART: Record<CategoryId, [string, string]> = {
  pdf: ['#006DFC', '#3A86FF'],
  image: ['#129A57', '#1E9E5F'],
  converter: ['#C96A00', '#C8740F'],
  optimizer: ['#0E8F86', '#12A398'],
  security: ['#B23A48', '#E14F5B'],
  editor: ['#8A4DE0', '#9468F2'],
  ai: ['#C2357A', '#DD5A9B'],
};

export function chartColor(cat: CategoryId, theme: Theme): string {
  return CHART[cat][theme.dark ? 1 : 0];
}
