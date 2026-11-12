/**
 * Party-popper confetti: two bursts from the sides that arc up, drift and fall, then fade.
 * Runs on the UI thread (Reanimated); skipped when the phone asks for reduced motion.
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const COLORS = ['#17AF64', '#006DFC', '#F5B700', '#E14F5B', '#8A4DE0', '#12A398', '#FF8A3D', '#04336B'];
const COUNT = 64;

type Piece = { x0: number; y0: number; vx: number; vy: number; spin: number; w: number; h: number; round: boolean; color: string; delay: number; dur: number; sway: number };

function Bit({ p, g }: { p: Piece; g: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: p.dur, easing: Easing.linear }));
  }, [p, t]);
  const style = useAnimatedStyle(() => {
    const s = t.value * (p.dur / 1000); // seconds
    // drag slows the burst, gravity pulls it down, a little side-to-side flutter
    const k = 1 - Math.exp(-2.2 * s);
    const x = p.x0 + (p.vx / 2.2) * k + Math.sin(s * 6 + p.sway) * 10 * t.value;
    const y = p.y0 + (p.vy / 2.2) * k + 0.5 * g * s * s;
    return {
      opacity: t.value === 0 ? 0 : t.value < 0.8 ? 1 : (1 - t.value) / 0.2,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${p.spin * s}deg` }, { rotateX: `${s * 420}deg` }],
    };
  });
  const radius = p.round ? p.w : 2;
  return <Animated.View style={[styles.bit, { width: p.w, height: p.h, borderRadius: radius, backgroundColor: p.color }, style]} />;
}

export default function Confetti({ play }: { play: boolean }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const pieces = useMemo<Piece[]>(() => {
    const out: Piece[] = [];
    for (let i = 0; i < COUNT; i++) {
      const left = i % 2 === 0;
      const ang = ((left ? -62 : -118) + (Math.random() - 0.5) * 34) * (Math.PI / 180);
      const speed = 900 + Math.random() * 650;
      const round = Math.random() < 0.3;
      out.push({
        x0: left ? -6 : width + 6,
        y0: height * 0.42,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        spin: (Math.random() - 0.5) * 720,
        w: round ? 8 : 7 + Math.random() * 4,
        h: round ? 8 : 12 + Math.random() * 6,
        round,
        color: COLORS[i % COLORS.length],
        delay: Math.floor(i / 2) * 9,
        dur: 2200 + Math.random() * 900,
        sway: Math.random() * 6,
      });
    }
    return out;
    // new bursts each time it plays
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, width, height]);
  if (!play || reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Bit key={i} p={p} g={1500} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bit: { position: 'absolute', left: 0, top: 0 },
});
