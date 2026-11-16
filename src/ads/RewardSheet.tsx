/**
 * "Take a break from ads": the person chooses to watch one rewarded video, and Fileora then
 * shows no other ads for the hours set in App Center. Nothing plays until "Watch ad" is tapped;
 * "Not now" is just as easy.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { rewardHours, watchForAdFree } from './ads';
import { Theme } from '../theme';
import { type } from '../typography';

export function untilText(ms: number) {
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay
    ? time
    : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

export default function RewardSheet({
  visible,
  theme,
  onClose,
}: {
  visible: boolean;
  theme: Theme;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  if (!visible) return null;
  const hours = rewardHours();
  const watch = async () => {
    setBusy(true);
    const r = await watchForAdFree();
    setBusy(false);
    onClose();
    if (r === 'ok')
      Alert.alert(
        'Enjoy Fileora without ads',
        `No ads until ${untilText(Date.now() + hours * 3600000)}.`,
      );
    else if (r === 'noad')
      Alert.alert(
        'No video right now',
        'There’s no video available at the moment. Please try again later.',
      );
  };
  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={busy ? undefined : onClose}
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        entering={FadeInUp.duration(300).easing(Easing.out(Easing.cubic))}
        style={[
          styles.sheet,
          { backgroundColor: theme.surface, paddingBottom: insets.bottom + 24 },
        ]}
        accessibilityViewIsModal
      >
        <View style={[styles.handle, { backgroundColor: theme.line }]} />
        <View style={[styles.icon, { backgroundColor: theme.accent + '24' }]}>
          <Icon name="clock" size={28} color={theme.accentInk} />
        </View>
        <Text
          style={[type.title, { color: theme.ink }]}
          accessibilityRole="header"
        >
          Take a {hours}-hour break from ads
        </Text>
        <Text style={[type.body, { color: theme.ink2 }]}>
          Watch one short video ad and Fileora shows no banner or full-screen
          ads for the next {hours} hours. All tools stay free either way.
        </Text>
        <View style={[styles.note, { backgroundColor: theme.bg }]}>
          <Icon name="info" size={18} color={theme.muted} />
          <Text style={[type.bodySm, styles.flex, { color: theme.muted }]}>
            If you close the video before it ends, the break doesn’t start.
          </Text>
        </View>
        <PressableScale
          onPress={watch}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ busy }}
          style={[styles.btn, { backgroundColor: theme.accent }]}
        >
          {busy ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={[type.button, { color: theme.onAccent }]}>
              Watch ad
            </Text>
          )}
        </PressableScale>
        <PressableScale
          onPress={onClose}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.btn, styles.btnLine, { borderColor: theme.line }]}
        >
          <Text style={[type.button, { color: theme.ink }]}>Not now</Text>
        </PressableScale>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2,11,23,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 14,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
  },
  btn: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLine: { borderWidth: 1 },
});
