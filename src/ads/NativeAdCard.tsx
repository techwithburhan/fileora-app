/**
 * Home: one native ad card (App Center → Ads → "Home: native ad card"), in the app's card style
 * with a clear "Ad" label. Google's AdChoices icon sits in the top-right corner. The card keeps
 * its space while the ad loads and disappears if Google has no ad, so it never covers anything.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  NativeAdChoicesPlacement,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaAspectRatio,
  NativeMediaView,
  useNativeAd,
} from 'react-native-google-mobile-ads';
import { useAdUnit } from './ads';
import { Theme } from '../theme';
import { type } from '../typography';

const OPTIONS = {
  adChoicesPlacement: NativeAdChoicesPlacement.TOP_RIGHT,
  aspectRatio: NativeMediaAspectRatio.LANDSCAPE,
};

export function AdLabel({ theme }: { theme: Theme }) {
  return (
    <View
      style={[styles.badge, theme.dark ? styles.badgeDark : styles.badgeLight]}
      accessibilityLabel="Advertisement"
    >
      <Text
        style={[
          styles.badgeText,
          theme.dark ? styles.badgeTextDark : styles.badgeTextLight,
        ]}
      >
        Ad
      </Text>
    </View>
  );
}

export default function NativeAdCard({ theme }: { theme: Theme }) {
  const unit = useAdUnit('home_native');
  const { nativeAd, status } = useNativeAd({
    adUnitId: unit,
    requestOptions: OPTIONS,
    autoLoad: !!unit,
  });
  if (!unit || status === 'no-fill' || status === 'error' || status === 'idle')
    return null;
  const box = [
    styles.card,
    { backgroundColor: theme.surface, borderColor: theme.line },
  ];
  if (!nativeAd) {
    // loading: keep the space so nothing jumps when the ad arrives
    return (
      <View
        style={[box, styles.loading]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <AdLabel theme={theme} />
        <View style={[styles.ghost, { backgroundColor: theme.surface2 }]} />
      </View>
    );
  }
  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <NativeAdView nativeAd={nativeAd} style={box}>
        <View style={styles.top}>
          <AdLabel theme={theme} />
          {nativeAd.advertiser ? (
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <Text
                style={[type.caption, styles.flex, { color: theme.muted }]}
                numberOfLines={1}
              >
                {nativeAd.advertiser}
              </Text>
            </NativeAsset>
          ) : (
            <View style={styles.flex} />
          )}
          <View style={styles.choicesSpace} />
        </View>
        <NativeMediaView
          style={[styles.media, { backgroundColor: theme.surface2 }]}
          resizeMode="cover"
        />
        <View style={styles.row}>
          {nativeAd.icon?.url ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image
                source={{ uri: nativeAd.icon.url }}
                style={[styles.icon, { backgroundColor: theme.surface2 }]}
              />
            </NativeAsset>
          ) : null}
          <View style={styles.flex}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text
                style={[type.heading, { color: theme.ink }]}
                numberOfLines={2}
              >
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            {nativeAd.body ? (
              <NativeAsset assetType={NativeAssetType.BODY}>
                <Text
                  style={[type.bodySm, { color: theme.muted }]}
                  numberOfLines={2}
                >
                  {nativeAd.body}
                </Text>
              </NativeAsset>
            ) : null}
          </View>
        </View>
        {nativeAd.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text
              style={[
                styles.cta,
                { color: theme.ink, borderColor: theme.ink2 },
              ]}
              numberOfLines={1}
            >
              {nativeAd.callToAction}
            </Text>
          </NativeAsset>
        ) : null}
      </NativeAdView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  loading: { minHeight: 300 },
  ghost: { flex: 1, borderRadius: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  choicesSpace: { width: 22, height: 18 }, // Google's AdChoices icon goes here
  badge: {
    minWidth: 24,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeLight: { backgroundColor: '#FFE9A8', borderColor: '#E8C65A' },
  badgeDark: { backgroundColor: '#3A2A0B', borderColor: '#7A5A12' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  badgeTextLight: { color: '#5C4300' },
  badgeTextDark: { color: '#FFE9A8' },
  media: { width: '100%', height: 150, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  icon: { width: 48, height: 48, borderRadius: 12 },
  cta: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 42,
    paddingHorizontal: 14,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 40,
    fontSize: 14.5,
    fontWeight: '700',
    overflow: 'hidden',
  },
});
