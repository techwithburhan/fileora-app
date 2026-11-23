/**
 * App 1.2: a notification that arrives while the app is open slides in from the top as Fileora's
 * own banner (spring in, fades out after 5 seconds, swipe up to close, tap to read the whole
 * message). Same look on Android and iPhone; respects "Reduce motion".
 *
 *   showBanner({ id, title, body, topic, onPress })   // from anywhere (src/remote/push.ts)
 *   <InAppBanner />                                   // once, near the root (App.tsx)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../i18n/Text';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { Theme } from '../theme';
import { type } from '../typography';
import { tr } from '../i18n/i18n';

export type BannerItem = { id: string; title: string; body: string; topic: string; onPress: () => void; /** how long it stays (ms), default 5000 */ ms?: number };

export const TOPIC_ICON: Record<string, IconName> = { all: 'bell', updates: 'download', news: 'blog', tools: 'grid', offers: 'party', blog: 'blog' };

let current: ((b: BannerItem) => void) | null = null;
let waiting: BannerItem | null = null;

/** Shows a banner (the newest replaces one that is still on screen). */
export function showBanner(b: BannerItem) {
  if (current) current(b);
  else waiting = b; // before the root view is ready: shown as soon as it is
}

const SHOW_MS = 5000;

export default function InAppBanner({ theme }: { theme: Theme }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [item, setItem] = useState<BannerItem | null>(null);
  const y = useSharedValue(-160);
  const o = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    o.value = withTiming(0, { duration: 180 });
    y.value = withTiming(-160, { duration: 240, easing: Easing.in(Easing.cubic) }, done => {
      if (done) runOnJS(setItem)(null);
    });
  }, [o, y]);

  const show = useCallback(
    (b: BannerItem) => {
      setItem(b);
      y.value = reduced ? 0 : -120;
      o.value = reduced ? 1 : 0;
      if (!reduced) {
        y.value = withSpring(0, { damping: 18, stiffness: 220, mass: 0.8 });
        o.value = withTiming(1, { duration: 160 });
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, b.ms ?? SHOW_MS);
    },
    [hide, o, y, reduced],
  );

  useEffect(() => {
    current = show;
    if (waiting) {
      const w = waiting;
      waiting = null;
      show(w);
    }
    return () => {
      current = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [show]);

  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onUpdate(e => {
      y.value = Math.min(12, e.translationY);
    })
    .onEnd(e => {
      if (e.translationY < -24 || e.velocityY < -500) runOnJS(hide)();
      else y.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  if (!item) return null;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.wrap, { top: insets.top + 8 }, anim]} accessibilityLiveRegion="polite">
        <PressableScale
          scaleTo={0.98}
          onPress={() => {
            hide();
            item.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={tr('New notification: {title}. Tap to read it.', { title: item.title })}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={[styles.icon, { backgroundColor: theme.accent + '24' }]}>
            <Icon name={TOPIC_ICON[item.topic] ?? 'bell'} size={20} color={theme.accentInk} />
          </View>
          <View style={styles.flex}>
            <Text style={[type.heading, { color: theme.ink }]} numberOfLines={1}>
              {item.title}
            </Text>
            {!!item.body && (
              <Text style={[type.bodySm, { color: theme.ink2 }]} numberOfLines={2}>
                {item.body}
              </Text>
            )}
          </View>
          <Icon name="chevron" size={18} color={theme.muted} />
        </PressableScale>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 60, elevation: 60 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
});
