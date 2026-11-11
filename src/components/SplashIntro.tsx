/**
 * Netflix-style intro (Reanimated 4, runs on the UI thread):
 *  1. the F icon sits in the middle of the navy screen (same size and place as the Android 12+
 *     system splash, so the hand-over is seamless) and a green glow breathes in;
 *  2. the icon pulls back a little;
 *  3. it zooms through the screen while ribbons in the brand colours stream out from the centre
 *     and the navy fades away, revealing the app.
 * With "Remove animations" switched on in Android, it simply fades.
 */
import React, { useEffect } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { FIcon } from './Brand';
import { brand } from '../theme';

const ICON_H = 132; // = the artwork inside res/drawable-*/splash_icon.png (dp)
const seamless = Platform.OS === 'android' && Number(Platform.Version) >= 31;
const RIBBONS = [brand.blue, brand.green, brand.blueDark, brand.greenDark, '#3D8BFF', '#4FD18F', brand.blue, brand.green];

function Ribbon({ i, p, height }: { i: number; p: SharedValue<number>; height: number }) {
  const side = i % 2 === 0 ? -1 : 1;
  const lane = Math.floor(i / 2);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: interpolate(t, [0, 0.15, 0.7, 1], [0, 0.85, 0.5, 0]),
      transform: [
        { translateX: side * interpolate(t, [0, 1], [6 + lane * 8, 40 + lane * 52]) },
        { scaleY: interpolate(t, [0, 1], [0.2, 1.4]) },
        { scaleX: interpolate(t, [0, 1], [0.5, 1.6]) },
      ],
    };
  });
  return <Animated.View style={[styles.ribbon, { height, backgroundColor: RIBBONS[i] }, style]} />;
}

export default function SplashIntro({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const scale = useSharedValue(seamless ? 1 : 0.72);
  const icon = useSharedValue(seamless ? 1 : 0);
  const glow = useSharedValue(0);
  const ribbons = useSharedValue(0);
  const screen = useSharedValue(1);

  useEffect(() => {
    const finish = (ok?: boolean) => {
      'worklet';
      if (ok) runOnJS(onDone)();
    };
    if (reduce) {
      icon.value = 1;
      scale.value = 1;
      screen.value = withDelay(500, withTiming(0, { duration: 400 }, finish));
      return;
    }
    // Timeline (ms): 0–450 appear · 450–750 pull back · 750–1550 zoom · 700–1600 ribbons · 1250–1650 fade
    const rush = Easing.bezier(0.55, 0, 0.9, 0.35); // slow start, very fast end: the Netflix "rush"
    icon.value = withTiming(1, { duration: 350 });
    glow.value = withSequence(withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }), withDelay(150, withTiming(0, { duration: 250 })));
    scale.value = withSequence(
      withTiming(1, { duration: 450, easing: Easing.out(Easing.back(1.4)) }),
      withTiming(0.88, { duration: 300, easing: Easing.inOut(Easing.quad) }),
      withTiming(24, { duration: 800, easing: rush }),
    );
    ribbons.value = withDelay(700, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    screen.value = withDelay(1250, withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) }, finish));
  }, [reduce, glow, icon, onDone, ribbons, scale, screen]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screen.value }));
  const iconStyle = useAnimatedStyle(() => ({ opacity: icon.value, transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: interpolate(glow.value, [0, 1], [0.6, 1.25]) }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.screen, screenStyle]} pointerEvents="none" accessible accessibilityLabel="Fileora">
      <View style={styles.ribbons}>
        {RIBBONS.map((_, i) => (
          <Ribbon key={i} i={i} p={ribbons} height={height * 0.9} />
        ))}
      </View>
      <Animated.View style={[styles.glow, glowStyle]} />
      <Animated.View style={iconStyle}>
        <FIcon height={ICON_H} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: brand.navy, alignItems: 'center', justifyContent: 'center', zIndex: 50, elevation: 50 },
  ribbons: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ribbon: { position: 'absolute', width: 8, borderRadius: 4 },
  glow: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(23, 175, 100, 0.22)',
    borderWidth: 2,
    borderColor: 'rgba(23, 175, 100, 0.45)',
    shadowColor: brand.green,
    shadowOpacity: 0.9,
    shadowRadius: 60,
  },
});
