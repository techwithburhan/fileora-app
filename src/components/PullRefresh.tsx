/**
 * Pull to refresh with the Fileora logo (app 1.0), like Instagram's: pull the page down and a small
 * F logo appears with a ring around it that fills as you pull. Let go past the line and the ring
 * spins while the latest settings, alerts, events, promotions and posts are fetched; then the page
 * slides back to the top.
 *
 * How: react-native-gesture-handler watches the drag next to the list's own scrolling (a Native
 * gesture for the list, a Pan that only counts while the list is at the very top). The list itself
 * never bounces or stretches at the top (bounces / overScrollMode off), so the same thing happens on
 * Android and iPhone and it never fights normal scrolling. Sideways swipes (carousels) are left alone.
 * Nothing here touches running tasks: a refresh only reads data.
 *
 * App 1.2: the ring keeps turning until the refresh has really finished, then a small note says
 * what happened: "Updated" (the website answered; with plugin 2.22 never a cached copy), or
 * "Couldn't refresh — showing saved info" when it didn't. onRefresh tells it: an error text (or a
 * list containing one), or a thrown error, means it failed; anything else means it worked.
 *
 *   <PullRefresh theme={theme} onRefresh={refresh}>
 *     <Animated.FlatList … />          // or Animated.ScrollView; any Animated scrollable
 *   </PullRefresh>
 * If the screen has its own scroll handler, pass its scrollY (a shared value of contentOffset.y).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Text from '../i18n/Text';
import Icon from './Icon';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeOut,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { FIcon } from './Brand';
import { Theme } from '../theme';
import { tr } from '../i18n/i18n';

const SIZE = 46;
const R = 20;
const C = 2 * Math.PI * R;
const THRESHOLD = 76; // pull this far (after the rubber band) and let go to refresh
const HOLD = 66; // where the page waits while refreshing
const MAX = 150;
const MIN_SPIN = 650; // ms: the ring always turns a little, so a fast refresh doesn't flash

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  theme: Theme;
  /** resolves with null/undefined when it worked, an error text (or an array with one) when not */
  onRefresh: () => Promise<unknown> | unknown;
  scrollY?: SharedValue<number>;
  enabled?: boolean;
  children: React.ReactElement;
};

export default function PullRefresh({ theme, onRefresh, scrollY: external, enabled = true, children }: Props) {
  const own = useSharedValue(0);
  const scrollY = external ?? own;
  const pull = useSharedValue(0);
  const base = useSharedValue(0); // the drag distance when the list reached the top
  const busy = useSharedValue(false);
  const spin = useSharedValue(0);
  const reduced = useReducedMotion();

  const onScroll = useAnimatedScrollHandler(e => {
    own.value = e.contentOffset.y;
  });

  const [note, setNote] = useState<{ ok: boolean; key: number } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
  }, []);
  const finish = useCallback(
    (ok: boolean) => {
      busy.value = false;
      cancelAnimation(spin);
      pull.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
      setNote({ ok, key: Date.now() });
      AccessibilityInfo.announceForAccessibility(ok ? tr('Updated') : tr('Couldn’t refresh. Showing saved info.'));
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setNote(null), ok ? 1600 : 3200);
    },
    [busy, spin, pull],
  );

  const start = useCallback(() => {
    const t0 = Date.now();
    setNote(null);
    Promise.resolve()
      .then(() => onRefresh())
      .then(
        r => !failed(r),
        () => false,
      )
      .then(ok => new Promise<boolean>(res => setTimeout(() => res(ok), Math.max(0, MIN_SPIN - (Date.now() - t0)))))
      .then(finish);
  }, [onRefresh, finish]);

  const native = useMemo(() => Gesture.Native(), []);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetY(8) // only downward drags
        .failOffsetX([-18, 18]) // sideways: a carousel's swipe, not ours
        .simultaneousWithExternalGesture(native)
        .onStart(e => {
          base.value = scrollY.value > 0.5 ? e.translationY : 0;
        })
        .onUpdate(e => {
          if (busy.value) return;
          if (scrollY.value > 0.5) {
            // still scrolling the list towards the top: start counting from here
            base.value = e.translationY;
            pull.value = 0;
            return;
          }
          const d = Math.max(0, e.translationY - base.value);
          pull.value = Math.min(MAX, MAX * (1 - Math.exp(-d / 210))); // rubber band
        })
        .onEnd(() => {
          if (busy.value) return;
          if (pull.value >= THRESHOLD) {
            busy.value = true;
            pull.value = withTiming(HOLD, { duration: 200 });
            if (!reduced) spin.value = withRepeat(withTiming(360, { duration: 850, easing: Easing.linear }), -1, false);
            runOnJS(start)();
          } else {
            pull.value = withTiming(0, { duration: 220 });
          }
        })
        .onFinalize(() => {
          if (!busy.value && pull.value > 0 && pull.value < THRESHOLD) pull.value = withTiming(0, { duration: 220 });
        }),
    [enabled, native, base, scrollY, busy, pull, spin, reduced, start],
  );

  const content = useAnimatedStyle(() => ({ transform: [{ translateY: pull.value }] }));
  const indicator = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [8, 36], [0, 1], 'clamp'),
    transform: [{ translateY: pull.value / 2 - SIZE / 2 }, { scale: interpolate(pull.value, [0, THRESHOLD], [0.55, 1], 'clamp') }],
  }));
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value - 90}deg` }] }));
  const arc = useAnimatedProps(() => ({
    strokeDashoffset: C * (1 - (busy.value ? 0.3 : Math.min(1, pull.value / THRESHOLD))),
  }));

  const child = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    ...(external ? null : { onScroll, scrollEventThrottle: 16 }),
    bounces: false,
    overScrollMode: 'never',
  });

  return (
    <View style={styles.flex}>
      <Animated.View pointerEvents="none" style={[styles.indicator, indicator]} accessibilityLiveRegion="polite" accessibilityLabel={tr('Refreshing')}>
        <View style={[styles.badge, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Animated.View style={[StyleSheet.absoluteFill, ring]}>
            <Svg width={SIZE} height={SIZE}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={theme.line} strokeWidth={3} fill="none" />
              <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={theme.accent} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={`${C} ${C}`} animatedProps={arc} />
            </Svg>
          </Animated.View>
          <FIcon height={19} />
        </View>
      </Animated.View>
      {note && (
        <Animated.View key={note.key} entering={FadeInDown.duration(220)} exiting={FadeOut.duration(200)} pointerEvents="none" style={styles.noteWrap}>
          <View style={[styles.note, { backgroundColor: note.ok ? theme.surface : theme.warnBg, borderColor: note.ok ? theme.line : theme.warnLine }]}>
            <Icon name={note.ok ? 'check' : 'info'} size={15} color={note.ok ? theme.accentInk : theme.warnInk} width={2.4} />
            <Text style={[styles.noteText, { color: note.ok ? theme.ink : theme.warnInk }]}>{note.ok ? 'Updated' : 'Couldn’t refresh. Showing saved info.'}</Text>
          </View>
        </Animated.View>
      )}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.flex, content]}>
          <GestureDetector gesture={native}>{child}</GestureDetector>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/** An error text, or a list (Promise.all) with one, means the refresh didn't get fresh data. */
function failed(r: unknown): boolean {
  if (typeof r === 'string') return r.length > 0;
  if (Array.isArray(r)) return r.some(failed);
  return r instanceof Error;
}

const styles = StyleSheet.create({
  noteWrap: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center', zIndex: 3 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 6, elevation: 3, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  noteText: { fontSize: 12.5, fontWeight: '700' },
  flex: { flex: 1 },
  indicator: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  badge: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', elevation: 2 },
});
