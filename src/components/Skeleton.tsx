/**
 * App 1.2: a placeholder block with a soft shimmer, shown while content loads (alert details, the
 * blog list). Animates opacity only (UI thread), stops with "Reduce motion".
 */
import React, { useEffect } from 'react';
import { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Theme } from '../theme';

export default function Skeleton({ theme, width = '100%', height = 16, radius = 8, style }: { theme: Theme; width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0.55);
  useEffect(() => {
    if (!reduced) p.value = withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(p);
  }, [p, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: p.value }));
  return <Animated.View accessible={false} style={[{ width, height, borderRadius: radius, backgroundColor: theme.surface2 }, anim, style]} />;
}
