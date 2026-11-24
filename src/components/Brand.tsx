/** The official Fileora logo and F icon, drawn exactly from the brand SVGs. */
import React, { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';
import { ICON_RATIO, ICON_SVG, LOGO_RATIO, LOGO_SVG } from '../assets/brand';

/** onDark: "File" in white instead of navy (same as the website in dark mode and on the navy footer). */
export function Logo({ height = 32, onDark = false }: { height?: number; onDark?: boolean }) {
  const xml = useMemo(() => (onDark ? LOGO_SVG.split('#04336B').join('#FFFFFF') : LOGO_SVG), [onDark]);
  return <SvgXml xml={xml} height={height} width={Math.round(height * LOGO_RATIO)} />;
}

export function FIcon({ height = 40 }: { height?: number }) {
  return <SvgXml xml={ICON_SVG} height={height} width={Math.round(height * ICON_RATIO)} />;
}
