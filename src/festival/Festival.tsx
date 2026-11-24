/**
 * Festival themes (App Center → Festival Themes, plugin 2.20+):
 *   - FestivalBanner: the festival artwork with its greeting at the top of Home (tap = its link,
 *     × = hide it for this festival);
 *   - FestivalOverlay: a short animation over the app when it opens (snow, hearts, petals, stars,
 *     sparkles, fireworks, lanterns, colour powder, confetti), as often as App Center says; never
 *     with "reduce motion" on;
 *   - useFestivalPrefetch: downloads the next festival's uploaded image ahead of time.
 * The accent colour itself is applied by useTheme() (theme.ts).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Text from '../i18n/Text';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect, SvgXml } from 'react-native-svg';

import { Festival, FestivalAnim, remote, useRemote } from '../remote/remote';
import { FESTIVAL_ART } from './art';
import { Theme } from '../theme';
import { type } from '../typography';
import { tr } from '../i18n/i18n';

export function useFestival(): Festival | null {
  return useRemote(s => s.config?.festival ?? null);
}

/** Fetches the uploaded images of the current and next festival, so they show at once and offline. */
export function useFestivalPrefetch() {
  const now = useRemote(s => s.config?.festival?.image ?? '');
  const next = useRemote(s => s.config?.festival_next?.image ?? '');
  useEffect(() => {
    for (const u of [now, next]) if (u) Image.prefetch(u).catch(() => {});
  }, [now, next]);
}

const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ banner */

export function FestivalBanner({ theme }: { theme: Theme }) {
  const f = useFestival();
  const closed = useRemote(s => s.dismissed.festival ?? '');
  const [failed, setFailed] = useState(false);
  if (!f || closed === `${f.id}|${f.v}`) return null;
  const art = !f.image || failed ? FESTIVAL_ART[f.design] : '';
  const greeting = f.builtin ? tr(f.greeting) : f.greeting;
  const sub = f.builtin ? tr(f.sub) : f.sub;
  const body = (
    <View style={[styles.banner, { backgroundColor: f.accent || theme.accent, borderColor: theme.line }]}>
      {f.image && !failed ? (
        <Image source={{ uri: f.image }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : art ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SvgXml xml={art} width="100%" height="100%" preserveAspectRatio="xMaxYMid slice" />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[type.section, styles.greet, { color: f.ink }]} numberOfLines={2} maxFontSizeMultiplier={1.4}>
          {greeting}
        </Text>
        {sub ? (
          <Text style={[type.bodySm, { color: f.ink }]} numberOfLines={2} maxFontSizeMultiplier={1.4}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => remote.dismiss('festival', `${f.id}|${f.v}`)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={tr('Hide the festival banner')}
        style={styles.close}>
        <Text style={[styles.x, { color: f.ink }]}>×</Text>
      </Pressable>
    </View>
  );
  return (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} accessibilityRole="summary" accessibilityLabel={`${f.builtin ? tr(f.name) : f.name}. ${greeting} ${sub}`}>
      {f.link ? (
        <Pressable onPress={() => Linking.openURL(f.link).catch(() => {})} accessibilityRole="link">
          {body}
        </Pressable>
      ) : (
        body
      )}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ animation */

const COLOURS: Record<FestivalAnim, string[]> = {
  none: [],
  snow: ['#FFFFFF', '#EAF4FF', '#D6E9FF'],
  hearts: ['#FF4D6D', '#FF8FA3', '#C9184A'],
  petals: ['#FF8FA3', '#FFB4A2', '#FFD1DC', '#F9844A'],
  stars: ['#FFD166', '#FFF3B0', '#FFFFFF'],
  sparkles: ['#FFD166', '#FFB703', '#FFF3B0'],
  fireworks: ['#FFD166', '#F28482', '#8ECAE6', '#90E0B0', '#F7B2FF'],
  lanterns: ['#FFD27F', '#FFE29A', '#F4A261'],
  colours: ['#F72585', '#FFB703', '#4CC9F0', '#80ED99', '#7209B7'],
  confetti: ['#17AF64', '#006DFC', '#FFD166', '#F72585', '#FF8A00'],
};

function Shape({ kind, size, color }: { kind: FestivalAnim; size: number; color: string }) {
  switch (kind) {
    case 'hearts':
      return (
        <Svg width={size} height={size} viewBox="-1 -1 2 2">
          <Path d="M0 -0.35 C0 -0.75 -0.6 -0.85 -0.75 -0.45 C-0.9 -0.05 -0.4 0.35 0 0.7 C0.4 0.35 0.9 -0.05 0.75 -0.45 C0.6 -0.85 0 -0.75 0 -0.35Z" fill={color} />
        </Svg>
      );
    case 'stars':
    case 'sparkles':
      return (
        <Svg width={size} height={size} viewBox="-1 -1 2 2">
          <Path d="M0 -1 L0.24 -0.33 L0.95 -0.31 L0.39 0.12 L0.59 0.81 L0 0.4 L-0.59 0.81 L-0.39 0.12 L-0.95 -0.31 L-0.24 -0.33Z" fill={color} />
        </Svg>
      );
    case 'petals':
    case 'colours':
      return (
        <Svg width={size} height={size * 0.62} viewBox="-1 -0.62 2 1.24">
          <Path d="M-1 0 C-0.5 -0.62 0.5 -0.62 1 0 C0.5 0.62 -0.5 0.62 -1 0Z" fill={color} />
        </Svg>
      );
    case 'lanterns':
      return (
        <Svg width={size * 0.7} height={size} viewBox="0 0 14 20">
          <Rect x="4" y="0" width="6" height="2" rx="1" fill="#E9C46A" />
          <Path d="M3 2 H11 L13 5 V15 L11 18 H3 L1 15 V5Z" fill={color} />
          <Rect x="4" y="6" width="6" height="8" rx="1" fill="#FFFFFF" opacity={0.55} />
        </Svg>
      );
    case 'confetti':
      return <View style={{ width: size, height: size * 0.45, backgroundColor: color, borderRadius: 2 }} />;
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 2 2">
          <Circle cx="1" cy="1" r="1" fill={color} opacity={0.92} />
        </Svg>
      );
  }
}

type P = { x: number; size: number; delay: number; dur: number; sway: number; spin: number; color: string };

function Particle({ p, kind, height }: { p: P; kind: FestivalAnim; height: number }) {
  const t = useSharedValue(0);
  const up = kind === 'lanterns' || kind === 'sparkles';
  useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: p.dur, easing: Easing.linear }));
  }, [t, p.delay, p.dur]);
  const style = useAnimatedStyle(() => {
    const y = up ? height + 40 - t.value * (height + 120) : -40 + t.value * (height + 80);
    return {
      opacity: t.value === 0 ? 0 : t.value > 0.85 ? (1 - t.value) / 0.15 : 1,
      transform: [{ translateX: p.x + Math.sin(t.value * 6.28 * 1.5) * p.sway }, { translateY: y }, { rotate: `${t.value * p.spin}deg` }],
    };
  });
  return (
    <Animated.View style={[styles.particle, style]}>
      <Shape kind={kind} size={p.size} color={p.color} />
    </Animated.View>
  );
}

function Burst({ cx, cy, delay, color }: { cx: number; cy: number; delay: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }));
  }, [t, delay]);
  const dots = useMemo(() => Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2), []);
  return (
    <>
      {dots.map((a, i) => (
        <BurstDot key={i} t={t} cx={cx} cy={cy} a={a} color={color} />
      ))}
    </>
  );
}

function BurstDot({ t, cx, cy, a, color }: { t: { value: number }; cx: number; cy: number; a: number; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value,
    transform: [{ translateX: cx + Math.cos(a) * 70 * t.value }, { translateY: cy + Math.sin(a) * 70 * t.value + 30 * t.value * t.value }],
  }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

/** Plays once per app start, per day or per festival (App Center), then removes itself. */
export function FestivalOverlay() {
  const f = useFestival();
  const reduce = useReducedMotion();
  const seen = useRemote(s => s.dismissed.fanim ?? '');
  const { width, height } = useWindowDimensions();
  const [done, setDone] = useState(false);
  const [startedFor, setStartedFor] = useState('');

  const key = f ? `${f.id}|${f.v}` : '';
  const due = useMemo(() => {
    if (!f || f.animation === 'none' || f.anim_secs <= 0 || reduce) return false;
    if (startedFor === key) return true; // already playing this one
    const [sid, sday] = seen.split('#');
    if (f.anim_freq === 'once' && sid === key) return false;
    if (f.anim_freq === 'daily' && sid === key && sday === today()) return false;
    if (f.anim_freq === 'open' && playedThisRun === key) return false;
    return true;
  }, [f, reduce, seen, key, startedFor]);

  useEffect(() => {
    if (!due || !f || startedFor === key) return;
    playedThisRun = key;
    setStartedFor(key);
    setDone(false);
    remote.dismiss('fanim', `${key}#${today()}`);
    const t = setTimeout(() => setDone(true), f.anim_secs * 1000 + 600);
    return () => clearTimeout(t);
  }, [due, f, key, startedFor]);

  const parts = useMemo(() => {
    if (!f || f.animation === 'fireworks') return [];
    const pal = COLOURS[f.animation];
    const n = width > 600 ? 34 : 24;
    const ms = Math.max(2, f.anim_secs) * 1000;
    return Array.from({ length: n }, (_, i): P => ({
      x: Math.random() * width,
      size: f.animation === 'snow' ? 5 + Math.random() * 7 : 10 + Math.random() * 14,
      delay: Math.random() * ms * 0.45,
      dur: ms * (0.5 + Math.random() * 0.45),
      sway: 10 + Math.random() * 26,
      spin: f.animation === 'confetti' || f.animation === 'petals' || f.animation === 'colours' ? 180 + Math.random() * 360 : 0,
      color: pal[i % pal.length],
    }));
  }, [f, width]);

  const bursts = useMemo(() => {
    if (!f || f.animation !== 'fireworks') return [];
    const pal = COLOURS.fireworks;
    const n = Math.max(3, Math.round(f.anim_secs * 1.3));
    return Array.from({ length: n }, (_, i) => ({
      cx: width * (0.15 + Math.random() * 0.7),
      cy: height * (0.12 + Math.random() * 0.35),
      delay: (i / n) * (f.anim_secs * 1000 - 1300),
      color: pal[i % pal.length],
    }));
  }, [f, width, height]);

  if (!f || startedFor !== key || done) return null;
  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none" exiting={FadeOut.duration(400)} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {parts.map((p, i) => (
        <Particle key={i} p={p} kind={f.animation} height={height} />
      ))}
      {bursts.map((b, i) => (
        <Burst key={i} {...b} />
      ))}
    </Animated.View>
  );
}
let playedThisRun = '';

const styles = StyleSheet.create({
  banner: { minHeight: 112, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  text: { paddingVertical: 16, paddingLeft: 18, paddingRight: 44, maxWidth: '72%', gap: 3 },
  greet: { fontSize: 21, lineHeight: 26 },
  close: { position: 'absolute', top: 6, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.16)' },
  x: { fontSize: 20, lineHeight: 22, fontWeight: '700' },
  particle: { position: 'absolute', top: 0, left: 0 },
  dot: { position: 'absolute', top: 0, left: 0, width: 6, height: 6, borderRadius: 3 },
});
