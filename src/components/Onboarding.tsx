/**
 * App 1.2: first-launch setup — what Fileora may use and why, before anything is asked.
 *
 * Shown once (also once after updating from 1.1), after the splash. Each row explains what the
 * permission is for; only notifications are asked here, and only when the person taps "Allow"
 * (the system asks; Android 13+ / iOS). Nothing is asked again automatically after a "no":
 * a blocked permission offers the phone's Settings instead.
 *
 * Why only notifications: following Google Play's and Apple's rules, Fileora asks only for what a
 * feature needs at the moment it needs it, and uses the system pickers where possible:
 *  - Files and photos: the phone's own pickers (Android photo picker / document picker, iPhone
 *    photo picker) — Fileora sees only what the person chooses, so no storage or photo permission.
 *    Android 9 and older ask for storage once, the first time a file is saved to Downloads.
 *  - Camera: Android scans with Google's document scanner or the phone's camera app, so Fileora
 *    needs no camera permission at all. The iPhone asks the first time the scanner opens (after
 *    Fileora's own explanation, see lib/capture.ts).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Appear from './Appear';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../i18n/Text';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { FIcon } from './Brand';
import { enableNotifications, openSystemSettings, permission, pushAvailable, syncTopics } from '../remote/push';
import { remote, settingShown, useRemote } from '../remote/remote';
import { Theme } from '../theme';
import { type } from '../typography';
import { tr } from '../i18n/i18n';

type State = 'granted' | 'denied' | 'blocked' | 'none';

export function useNeedsOnboarding(): boolean {
  return useRemote(s => s.loaded && !s.prefs.onboarded);
}

export default function Onboarding({ theme }: { theme: Theme }) {
  const insets = useSafeAreaInsets();
  const [notif, setNotif] = useState<State>('none');
  const [asking, setAsking] = useState(false);
  const android = Platform.OS === 'android';
  const oldAndroid = android && Number(Platform.Version) < 29;
  const canNotify = pushAvailable() && settingShown('notify');
  // fade in with opacity only: a layout ("entering") animation that starts while the app's first
  // layout is still settling can keep a full-screen view at its first size on Android (see Appear)
  const reduced = useReducedMotion();
  const fade = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) fade.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [fade, reduced]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const check = useCallback(() => {
    permission().then(p =>
      setNotif(cur => (p === 'granted' ? 'granted' : cur === 'blocked' ? 'blocked' : cur === 'denied' || remote.prefs().askedAt > 0 ? 'denied' : 'none')),
    );
  }, []);
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', st => st === 'active' && check()); // back from the phone's Settings
    return () => sub.remove();
  }, [check]);

  const allow = async () => {
    if (notif === 'blocked') return openSystemSettings();
    setAsking(true);
    const r = await enableNotifications(); // the system's own question, then topics / direct delivery
    setAsking(false);
    setNotif(r);
  };
  const done = () => {
    remote.setPrefs({ onboarded: Date.now() });
    syncTopics();
  };

  const rows: { key: string; icon: IconName; title: string; text: string; status: string; ok: boolean; button?: { label: string; onPress: () => void } }[] = [];
  if (canNotify)
    rows.push({
      key: 'notify',
      icon: 'bell',
      title: tr('Notifications'),
      text: tr('App updates, new tools, daily news and offers. You choose the categories in Settings, and every notification is also kept in Alerts.'),
      status:
        notif === 'granted' ? tr('Allowed') : notif === 'blocked' ? tr('Blocked in the phone’s settings') : notif === 'denied' ? tr('Not allowed') : tr('Not asked yet'),
      ok: notif === 'granted',
      button:
        notif === 'granted'
          ? undefined
          : { label: notif === 'blocked' ? tr('Open Settings') : notif === 'denied' ? tr('Ask again') : tr('Allow'), onPress: allow },
    });
  rows.push({
    key: 'files',
    icon: 'folder',
    title: tr('Files and photos'),
    text: android
      ? oldAndroid
        ? tr('You pick files with the phone’s own picker: Fileora sees only what you choose. Android asks for storage once, the first time you save a file to Downloads.')
        : tr('You pick files and photos with the phone’s own picker: Fileora sees only what you choose, so no permission is needed.')
      : tr('You pick photos and files with the iPhone’s own picker: Fileora sees only what you choose. Saving an image to Photos asks once.'),
    status: oldAndroid ? tr('Asked when you first save') : tr('No permission needed'),
    ok: true,
  });
  rows.push({
    key: 'camera',
    icon: 'camera',
    title: tr('Camera (scanner)'),
    text: android
      ? tr('The scanner uses Google’s document scanner or your camera app, so Fileora itself needs no camera permission.')
      : tr('The scanner uses the camera. Your iPhone asks the first time you open it; photos stay on your iPhone unless you choose an online tool.'),
    status: android ? tr('No permission needed') : tr('Asked when you first scan'),
    ok: true,
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.bg }, fadeStyle]} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
        <Appear duration={380} style={styles.head}>
          <View style={[styles.logo, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <FIcon height={30} />
          </View>
          <Text style={[type.display, styles.center, { color: theme.ink }]} accessibilityRole="header">
            Welcome to Fileora
          </Text>
          <Text style={[type.body, styles.center, { color: theme.ink2 }]}>Here is what Fileora may use, and why. You can change all of this later in Settings.</Text>
        </Appear>
        {rows.map((r, i) => (
          <Appear key={r.key} delay={120 + i * 90} duration={380} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.cardTop}>
              <View style={[styles.icon, { backgroundColor: theme.accent + '1F' }]}>
                <Icon name={r.icon} size={21} color={theme.accentInk} />
              </View>
              <View style={styles.flex}>
                <Text style={[type.heading, { color: theme.ink }]}>{r.title}</Text>
                <View style={styles.statusRow}>
                  <Icon name={r.ok ? 'check' : 'info'} size={14} color={r.ok ? theme.accentInk : theme.muted} width={2.4} />
                  <Text style={[type.caption, { color: r.ok ? theme.accentInk : theme.muted }]}>{r.status}</Text>
                </View>
              </View>
            </View>
            <Text style={[type.bodySm, { color: theme.ink2 }]}>{r.text}</Text>
            {r.button ? (
              <PressableScale onPress={r.button.onPress} disabled={asking} accessibilityRole="button" style={[styles.small, { backgroundColor: theme.accent, opacity: asking ? 0.6 : 1 }]}>
                <Text style={[type.button, { color: theme.onAccent }]}>{r.button.label}</Text>
              </PressableScale>
            ) : null}
          </Appear>
        ))}
        <Appear delay={120 + rows.length * 90} duration={380}>
          <PressableScale onPress={done} accessibilityRole="button" accessibilityLabel={tr('Continue')} style={[styles.btn, { backgroundColor: theme.ink }]}>
            <Text style={[type.button, { color: theme.bg }]}>Continue</Text>
            <Icon name="chevron" size={18} color={theme.bg} width={2.3} />
          </PressableScale>
          {canNotify && notif !== 'granted' ? (
            <Text style={[type.caption, styles.center, styles.later, { color: theme.muted }]}>Without notifications, news and updates still appear in Alerts.</Text>
          ) : null}
        </Appear>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 40, elevation: 40 },
  content: { paddingHorizontal: 20, gap: 14 },
  head: { alignItems: 'center', gap: 10, marginBottom: 6 },
  logo: { width: 64, height: 64, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  small: { alignSelf: 'flex-start', minHeight: 42, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  later: { marginTop: 10 },
});
