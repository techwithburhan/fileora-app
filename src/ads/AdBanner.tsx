/**
 * A banner placement: the tool page's anchored banner, or the 300×250 rectangle at the bottom of
 * the result sheet. It sits under a divider and an "ADVERTISEMENT" label, apart from buttons,
 * and keeps its space while loading; if Google has no ad, the slot closes.
 */
import React, { useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Text from '../i18n/Text';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useAdUnit } from './ads';
import { Theme } from '../theme';

type Props = {
  placement: 'tool_banner' | 'result_rect';
  theme: Theme;
  style?: ViewStyle;
};

export default function AdBanner({ placement, theme, style }: Props) {
  const unit = useAdUnit(placement);
  const [failed, setFailed] = useState<string | null>(null);
  if (!unit || failed === unit) return null;
  const rect = placement === 'result_rect';
  return (
    <View
      style={[
        rect
          ? styles.rectWrap
          : [
              styles.anchorWrap,
              { borderTopColor: theme.line, backgroundColor: theme.bg },
            ],
        style,
      ]}
    >
      <Text
        style={[styles.label, { color: theme.muted }]}
        accessibilityRole="text"
      >
        ADVERTISEMENT
      </Text>
      <View style={rect ? styles.rectSlot : styles.anchorSlot}>
        <BannerAd
          key={unit}
          unitId={unit}
          size={
            rect
              ? BannerAdSize.MEDIUM_RECTANGLE
              : BannerAdSize.ANCHORED_ADAPTIVE_BANNER
          }
          onAdFailedToLoad={() => setFailed(unit)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchorWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    alignItems: 'center',
  },
  anchorSlot: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  rectWrap: { alignItems: 'center', gap: 6, marginTop: 20 },
  rectSlot: {
    width: 300,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
});
