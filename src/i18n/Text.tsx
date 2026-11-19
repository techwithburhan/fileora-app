/**
 * The app's Text: React Native's Text that translates its plain-string children into the chosen
 * language (src/i18n/i18n.ts). Strings that aren't UI text (file names, numbers) have no
 * translation and are shown as they are. Use it like React Native's Text.
 */
import React, { forwardRef } from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { tr, useLang } from './i18n';

function translate(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return tr(children);
  if (Array.isArray(children)) {
    // a single run of strings and numbers is joined first, so "Page {n}" style pieces aren't split
    return children.map(c => (typeof c === 'string' ? tr(c) : c));
  }
  return children;
}

const Text = forwardRef<React.ElementRef<typeof RNText>, TextProps & { noTranslate?: boolean }>(function AppText({ noTranslate, children, ...rest }, ref) {
  useLang(); // re-render when the language changes
  return (
    <RNText ref={ref} {...rest}>
      {noTranslate ? children : translate(children)}
    </RNText>
  );
});

export default Text;
export { Text };
