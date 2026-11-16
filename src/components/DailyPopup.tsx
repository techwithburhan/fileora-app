/**
 * Daily Update (App Center → Promotions → Daily Update popup): a card that slides up at the
 * bottom of Home, just above the bottom bar, with a bold heading, a short paragraph and a
 * button that opens a web page in the browser. It never blocks the app: Home stays usable
 * behind it, and × closes it.
 *
 * How often: "daily" = once a day (closed or tapped → back tomorrow), "once" = until the text or
 * link changes, "always" = every time the app opens.
 */
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeOutDown, SlideInDown } from 'react-native-reanimated';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { remote, useRemote } from '../remote/remote';
import { Theme } from '../theme';
import { type } from '../typography';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
let closedThisSession = ''; // "always": closed until the app is opened again

export default function DailyPopup({ theme }: { theme: Theme }) {
  const popup = useRemote(s => s.config?.popup ?? null);
  const closed = useRemote(s => s.dismissed.popup ?? '');
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  // a moment after Home appears, so it doesn't compete with the screen loading
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1800);
    return () => clearTimeout(t);
  }, []);

  if (!popup || !ready || hidden) return null;
  const [cid, cday] = closed.split('|');
  if (popup.freq === 'once' && cid === popup.id) return null;
  if (popup.freq === 'daily' && cid === popup.id && cday === today())
    return null;
  if (popup.freq === 'always' && closedThisSession === popup.id) return null;

  const close = () => {
    closedThisSession = popup.id;
    remote.dismiss('popup', `${popup.id}|${today()}`);
    setHidden(true);
  };
  const open = () => {
    Linking.openURL(popup.link).catch(() => {});
    close();
  };

  return (
    <Animated.View
      entering={SlideInDown.duration(420).easing(Easing.out(Easing.cubic))}
      exiting={FadeOutDown.duration(220)}
      style={styles.wrap}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.card,
          theme.dark ? styles.shadowDark : styles.shadowLight,
          { backgroundColor: theme.surface, borderColor: theme.line },
        ]}
        accessibilityRole="summary"
        accessibilityLiveRegion="polite"
      >
        <Text
          style={[type.heading, styles.title, { color: theme.ink }]}
          accessibilityRole="header"
        >
          {popup.title}
        </Text>
        {popup.text ? (
          <Text style={[type.bodySm, { color: theme.ink2 }]}>{popup.text}</Text>
        ) : null}
        <PressableScale
          onPress={open}
          accessibilityRole="link"
          accessibilityHint="Opens in your browser"
          style={[styles.btn, { backgroundColor: theme.accent }]}
        >
          <Text style={[type.button, { color: theme.onAccent }]}>
            {popup.button}
          </Text>
          <Icon name="external" size={16} color={theme.onAccent} width={2.3} />
        </PressableScale>
        <Pressable
          onPress={close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.close}
        >
          <Icon name="close" size={18} color={theme.muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    paddingRight: 48,
    gap: 6,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  title: { fontWeight: '800' },
  shadowLight: { shadowColor: '#04336B' },
  shadowDark: { shadowColor: '#000000' },
  btn: {
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
