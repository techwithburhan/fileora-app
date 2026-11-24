/**
 * The app's Text: React Native's Text that translates its plain-string children into the chosen
 * language (src/i18n/i18n.ts). Strings that aren't UI text (file names, numbers) have no
 * translation and are shown as they are. Use it like React Native's Text.
 */
import React, { forwardRef } from 'react';
import { StyleSheet, Text as RNText, TextProps, TextStyle } from 'react-native';
import { tr, useLang } from './i18n';

function translate(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return tr(children);
  if (Array.isArray(children)) {
    // a single run of strings and numbers is joined first, so "Page {n}" style pieces aren't split
    return children.map(c => (typeof c === 'string' ? tr(c) : c));
  }
  return children;
}

/**
 * Devanagari, Gurmukhi and Arabic script have marks above and below the letters: tight line
 * heights clip them (seen on iPhone: "सेकंडों" drawn as "सकडा") and negative letter spacing
 * breaks their shaping. In those languages headings get room and normal spacing.
 */
const TALL = new Set(['hi', 'pa', 'ur', 'ar']);
function scriptSafe(style: TextProps['style']): TextProps['style'] {
  try {
    const f = (StyleSheet.flatten(style) || {}) as TextStyle;
    const fix: { letterSpacing?: number; lineHeight?: number } = {};
    if (typeof f.letterSpacing === 'number' && f.letterSpacing < 0) fix.letterSpacing = 0;
    if (typeof f.fontSize === 'number' && typeof f.lineHeight === 'number' && f.lineHeight < f.fontSize * 1.35) {
      fix.lineHeight = Math.round(f.fontSize * 1.4);
    }
    return Object.keys(fix).length ? [style, fix] : style;
  } catch {
    return style;
  }
}

const Text = forwardRef<React.ElementRef<typeof RNText>, TextProps & { noTranslate?: boolean }>(function AppText({ noTranslate, children, ...rest }, ref) {
  const { lang } = useLang(); // re-render when the language changes
  const style = TALL.has(lang) ? scriptSafe(rest.style) : rest.style;
  return (
    <RNText ref={ref} {...rest} style={style}>
      {noTranslate ? children : translate(children)}
    </RNText>
  );
});

export default Text;
export { Text };
