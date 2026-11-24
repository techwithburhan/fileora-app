/**
 * Festival themes (App Center → Festival Themes, plugin 2.20+):
 *   - FestivalBanner: the festival artwork with its greeting at the top of Home (tap = its link,
 *     × = hide it for this festival);
 *   - FestivalOverlay: a short animation over the app when it opens — each festival's own
 *     (plugin 2.24: its particle shapes, colours and motions come with the festival), or one of
 *     the ten classic ones from older plugins — as often as App Center says; never with
 *     "reduce motion" on;
 *   - useFestivalPrefetch: downloads the next festival's uploaded image ahead of time.
 * The accent colour itself is applied by useTheme() (theme.ts).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Text from '../i18n/Text';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';

import { Festival, FestivalAnim, FestivalFx, FxLayer, FxShape, remote, useRemote } from '../remote/remote';
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

/*
 * Plugin 2.24 sends each festival's own animation: layers of particles (shape, mode, colours,
 * count, size, speed) with the shapes as SVG paths, so a new festival's animation needs no app
 * update. Older plugins send only one of the ten classic names; those are turned into layers here.
 */
const CIRCLE = 'M0 -1A1 1 0 1 1 0 1A1 1 0 1 1 0 -1Z';
const CLASSIC_SHAPES: Record<string, FxShape> = {
  circle: { d: CIRCLE },
  snow: { d: CIRCLE },
  heart: { d: 'M0 -0.45 C0 -0.95 -0.75 -1.05 -0.92 -0.55 C-1.1 -0.05 -0.5 0.45 0 0.9 C0.5 0.45 1.1 -0.05 0.92 -0.55 C0.75 -1.05 0 -0.95 0 -0.45Z' },
  star: { d: 'M0 -1 L0.24 -0.33 L0.95 -0.31 L0.39 0.12 L0.59 0.81 L0 0.4 L-0.59 0.81 L-0.39 0.12 L-0.95 -0.31 L-0.24 -0.33Z' },
  sparkle: { d: 'M0 -1 C0.1 -0.2 0.2 -0.1 1 0 C0.2 0.1 0.1 0.2 0 1 C-0.1 0.2 -0.2 0.1 -1 0 C-0.2 -0.1 -0.1 -0.2 0 -1Z', glow: 1 },
  petal: { d: 'M-1 0 C-0.5 -0.62 0.5 -0.62 1 0 C0.5 0.62 -0.5 0.62 -1 0Z' },
  lantern: { d: 'M-0.6 -0.78 H0.6 L0.72 -0.6 C1 -0.3 1 0.3 0.72 0.6 L0.6 0.78 H-0.6 L-0.72 0.6 C-1 0.3 -1 -0.3 -0.72 -0.6Z', d2: 'M-0.4 -1 H0.4 V-0.8 H-0.4Z M-0.4 0.8 H0.4 V1 H-0.4Z', c2: '#F6C453', glow: 1 },
  confetti: { d: 'M-1 -0.45 H1 V0.45 H-1Z' },
};
const CLASSIC: Record<Exclude<FestivalAnim, 'none'>, FxLayer> = {
  snow: { s: 'snow', m: 'fall', c: ['#FFFFFF', '#EAF4FF', '#D6E9FF'], n: 30, z: [6, 13], sp: 1 },
  hearts: { s: 'heart', m: 'fall', c: ['#FF4D6D', '#FF8FA3', '#C9184A'], n: 24, z: [10, 20], sp: 1 },
  petals: { s: 'petal', m: 'fall', c: ['#FF8FA3', '#FFB4A2', '#FFD1DC', '#F9844A'], n: 28, z: [9, 16], sp: 1 },
  stars: { s: 'star', m: 'twinkle', c: ['#FFD166', '#FFF3B0', '#FFFFFF'], n: 24, z: [8, 15], sp: 1 },
  sparkles: { s: 'sparkle', m: 'rise', c: ['#FFD166', '#FFB703', '#FFF3B0'], n: 22, z: [8, 16], sp: 1 },
  fireworks: { s: 'circle', m: 'burst', c: ['#FFD166', '#F28482', '#8ECAE6', '#90E0B0', '#F7B2FF'], n: 7, z: [2, 3.2], sp: 1 },
  lanterns: { s: 'lantern', m: 'rise', c: ['#FFD27F', '#FFE29A', '#F4A261'], n: 14, z: [16, 28], sp: 1 },
  colours: { s: 'circle', m: 'splash', c: ['#F72585', '#FFB703', '#4CC9F0', '#80ED99', '#7209B7'], n: 8, z: [40, 90], sp: 1 },
  confetti: { s: 'confetti', m: 'fall', c: ['#17AF64', '#006DFC', '#FFD166', '#F72585', '#FF8A00'], n: 30, z: [6, 11], sp: 1 },
};
export function festivalFx(f: Festival | null): FestivalFx | null {
  if (!f) return null;
  if (f.fx) return f.fx;
  if (f.animation === 'none') return null;
  return { layers: [CLASSIC[f.animation]], shapes: CLASSIC_SHAPES };
}

/** Shapes that turn as they move (how fast), and shapes that flap. */
const SPIN: Record<string, number> = {
  confetti: 1, petal: 1, leaf: 1, maple: 1, ribbon: 0.6, sakura: 0.8, ginkgo: 1, bodhi: 0.8, frond: 0.6, feather: 0.7, pennant: 0.5, tag: 0.8,
  flower: 0.6, marigold: 0.6, poppy: 0.6, daffodil: 0.6, rose: 0.5, star: 0.35, star8: 0.25, star9: 0.25, snow: 0.4, sun: 0.15, gear: 0.6,
  scallop: 0.7, wheat: 0.7, rakhi: 0.4, apple: 0.5, egg: 0.5, pencil: 0.9, horseshoe: 0.7, globe: 0.15, bean: 1, coin: 0.2, shamrock: 0.6,
  tulip: 0.4, thistle: 0.5,
};
const FLAP: Record<string, true> = { butterfly: true, bat: true };

const FxShapeView = React.memo(function FxShapeImage({ shape, box, color }: { shape: FxShape; box: number; color: string }) {
  const pad = shape.glow ? 1.7 : 1.15;
  return (
    <Svg width={box} height={box} viewBox={`${-pad} ${-pad} ${pad * 2} ${pad * 2}`}>
      {shape.glow ? <Circle cx="0" cy="0" r="1.55" fill={color} opacity={0.22} /> : null}
      <Path d={shape.d} fill={color} fillRule={shape.rule ?? 'nonzero'} />
      {shape.d2 ? <Path d={shape.d2} fill={shape.c2 ?? '#FFFFFF'} fillRule={shape.rule2 ?? 'nonzero'} /> : null}
    </Svg>
  );
});

type FP = {
  m: FxLayer['m'];
  shape: FxShape;
  box: number;
  color: string;
  x: number;
  y: number;
  delay: number;
  dur: number;
  sway: number;
  spin: number;
  flap: boolean;
  phase: number;
  cycles: number;
};

function FxParticle({ p, width, height }: { p: FP; width: number; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: p.dur, easing: Easing.linear }));
  }, [t, p.delay, p.dur]);
  const style = useAnimatedStyle(() => {
    const v = t.value;
    const wave = Math.sin(p.phase + v * 6.283 * p.cycles);
    let x = p.x;
    let y = p.y;
    let o = v === 0 ? 0 : v > 0.85 ? (1 - v) / 0.15 : Math.min(1, v * 10);
    if (p.m === 'fall') {
      y = -p.box + v * (height + p.box * 2);
      x = p.x + wave * p.sway;
    } else if (p.m === 'rise' || p.m === 'sway') {
      y = height + p.box - v * (height + p.box * 3);
      x = p.x + wave * p.sway;
    } else if (p.m === 'drift') {
      x = -p.box + v * (width + p.box * 2);
      y = p.y + wave * p.sway * 0.5;
    } else {
      o = o * (0.2 + 0.8 * (0.5 + 0.5 * wave));
    }
    const rot = p.spin ? p.spin * v * 360 : wave * (p.m === 'sway' ? 17 : 8);
    const sx = p.flap ? 0.35 + 0.65 * Math.abs(Math.cos(p.phase + v * 40)) : 1;
    return { opacity: o, transform: [{ translateX: x - p.box / 2 }, { translateY: y - p.box / 2 }, { rotate: `${rot}deg` }, { scaleX: sx }] };
  });
  return (
    <Animated.View style={[styles.particle, style]}>
      <FxShapeView shape={p.shape} box={p.box} color={p.color} />
    </Animated.View>
  );
}

function Burst({ cx, cy, delay, colors, dot, dist, drag, blob }: { cx: number; cy: number; delay: number; colors: string[]; dot: number; dist: number; drag: boolean; blob: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: drag ? 1600 : 1300, easing: Easing.out(Easing.quad) }));
  }, [t, delay, drag]);
  const dots = useMemo(() => Array.from({ length: drag ? 12 : 16 }, (_, i) => ({ a: (i / (drag ? 12 : 16)) * Math.PI * 2 + (drag ? Math.random() : 0), k: drag ? 0.4 + Math.random() * 0.6 : 1 })), [drag]);
  const blobStyle = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 0.5 * (1 - t.value),
    transform: [{ translateX: cx - blob / 2 }, { translateY: cy - blob / 2 }, { scale: 0.3 + 0.7 * Math.min(1, t.value * 2.5) }],
  }));
  return (
    <>
      {blob ? <Animated.View style={[styles.blob, { width: blob, height: blob, borderRadius: blob / 2, backgroundColor: colors[0] }, blobStyle]} /> : null}
      {dots.map((d, i) => (
        <BurstDot key={i} t={t} cx={cx} cy={cy} a={d.a} dist={dist * d.k} fall={drag ? 0 : 30} size={dot} color={colors[i % colors.length]} />
      ))}
    </>
  );
}

function BurstDot({ t, cx, cy, a, dist, fall, size, color }: { t: { value: number }; cx: number; cy: number; a: number; dist: number; fall: number; size: number; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value,
    transform: [{ translateX: cx + Math.cos(a) * dist * t.value - size / 2 }, { translateY: cy + Math.sin(a) * dist * t.value + fall * t.value * t.value - size / 2 }],
  }));
  return <Animated.View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Plays once per app start, per day or per festival (App Center), then removes itself. */
export function FestivalOverlay() {
  const f = useFestival();
  const reduce = useReducedMotion();
  const seen = useRemote(s => s.dismissed.fanim ?? '');
  const { width, height } = useWindowDimensions();
  const [done, setDone] = useState(false);
  const [startedFor, setStartedFor] = useState('');
  const fx = useMemo(() => festivalFx(f), [f]);

  const key = f ? `${f.id}|${f.v}` : '';
  const due = useMemo(() => {
    if (!f || !fx || f.anim_secs <= 0 || reduce) return false;
    if (startedFor === key) return true; // already playing this one
    const [sid, sday] = seen.split('#');
    if (f.anim_freq === 'once' && sid === key) return false;
    if (f.anim_freq === 'daily' && sid === key && sday === today()) return false;
    if (f.anim_freq === 'open' && playedThisRun === key) return false;
    return true;
  }, [f, fx, reduce, seen, key, startedFor]);

  useEffect(() => {
    if (!due || !f || startedFor === key) return;
    playedThisRun = key;
    setStartedFor(key);
    setDone(false);
    remote.dismiss('fanim', `${key}#${today()}`);
    const t = setTimeout(() => setDone(true), f.anim_secs * 1000 + 600);
    return () => clearTimeout(t);
  }, [due, f, key, startedFor]);

  // particles and bursts for every layer; at most about 44 moving shapes on a phone
  const { parts, bursts } = useMemo(() => {
    const out = { parts: [] as FP[], bursts: [] as Array<{ cx: number; cy: number; delay: number; colors: string[]; dot: number; dist: number; drag: boolean; blob: number }> };
    if (!f || !fx) return out;
    const ms = Math.max(2, f.anim_secs) * 1000;
    const small = width < 600;
    const flowing = fx.layers.filter(l => l.m !== 'burst' && l.m !== 'splash');
    const total = flowing.reduce((a, l) => a + l.n, 0) * (small ? 0.6 : 0.85);
    const k = (small ? 0.6 : 0.85) * Math.min(1, 44 / Math.max(1, total));
    for (const l of fx.layers) {
      if (l.m === 'burst' || l.m === 'splash') {
        const n = Math.max(2, Math.min(10, l.n));
        for (let i = 0; i < n; i++) {
          const splash = l.m === 'splash';
          out.bursts.push({
            cx: width * (0.12 + Math.random() * 0.76),
            cy: height * (splash ? 0.1 + Math.random() * 0.75 : 0.12 + Math.random() * 0.35),
            delay: ((i + Math.random() * 0.7) / n) * Math.max(800, ms - 1700),
            colors: splash ? [pick(l.c)] : [pick(l.c), pick(l.c)],
            dot: splash ? 5 : Math.max(4, l.z[1] * 2),
            dist: splash ? 60 + Math.random() * 40 : 70,
            drag: splash,
            blob: splash ? Math.min(160, (l.z[0] + Math.random() * (l.z[1] - l.z[0])) * 1.6) : 0,
          });
        }
        continue;
      }
      const shape = fx.shapes[l.s];
      if (!shape) continue;
      const n = Math.max(1, Math.round(l.n * k));
      for (let i = 0; i < n; i++) {
        const size = l.z[0] + Math.random() * (l.z[1] - l.z[0]);
        const twinkle = l.m === 'twinkle';
        const dur = twinkle ? ms * (0.75 + Math.random() * 0.25) : (ms * (0.5 + Math.random() * 0.4)) / Math.max(0.5, l.sp);
        out.parts.push({
          m: l.m,
          shape,
          box: size * (shape.glow ? 1.7 : 1.15),
          color: pick(l.c),
          x: Math.random() * width,
          y: twinkle ? height * (0.04 + Math.random() * 0.8) : height * (0.06 + Math.random() * 0.8),
          delay: twinkle ? Math.random() * ms * 0.2 : Math.random() * Math.max(0, ms - dur),
          dur: Math.min(dur, ms),
          sway: 8 + Math.random() * 22,
          spin: (SPIN[l.s] ?? 0) * (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.8),
          flap: !!FLAP[l.s],
          phase: Math.random() * 6.28,
          cycles: twinkle ? 2 + Math.random() * 2 : 1 + Math.random() * 1.2,
        });
      }
    }
    return out;
  }, [f, fx, width, height]);

  if (!f || !fx || startedFor !== key || done) return null;
  return (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none" exiting={FadeOut.duration(400)} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {parts.map((p, i) => (
        <FxParticle key={i} p={p} width={width} height={height} />
      ))}
      {bursts.map((b, i) => (
        <Burst key={`b${i}`} {...b} />
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
  dot: { position: 'absolute', top: 0, left: 0 },
  blob: { position: 'absolute', top: 0, left: 0 },
});
