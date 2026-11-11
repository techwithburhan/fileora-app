import { useColorScheme } from 'react-native';
import type { CategoryId } from './data/tools';

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
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
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
