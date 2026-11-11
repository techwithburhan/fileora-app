/** Line icons (24 px grid) for the UI and the tool categories. */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  resume: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5M9 8h2',
  blog: 'M4 5h16M4 10h16M4 15h10M4 20h7',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5 8 12l7 7',
  chevron: 'M9 6l6 6-6 6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
  pulse: 'M3 12h4l3-7 4 14 3-7h4',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  check: 'M5 12.5l4.2 4.2L19 7',
  // categories
  pdf: 'M7 3h7l4 4v14H7zM13 3v5h5M9.5 13h5M9.5 16.5h5',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01',
  converter: 'M5 8h11l-3-3M19 16H8l3 3',
  optimizer: 'M13 3 5 14h6l-1 7 8-11h-6z',
  security: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2',
  editor: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  ai: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z',
} as const;

export type IconName = keyof typeof P;

export default function Icon({ name, size = 24, color, width = 2 }: { name: IconName; size?: number; color: string; width?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={P[name]} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
