/**
 * Settings → Check notifications: what can stop Fileora's notifications on this phone, each with
 * a button to the right phone setting, and "Send a test notification" (App Center may hide it).
 *
 * Android: notifications allowed, the "Updates and news" channel (sound and pop-up), battery
 * limits, and the phone maker's Autostart screen (Xiaomi, Vivo, Oppo, Realme…), which stops
 * notifications for apps that were swiped away. iPhone: allowed, sound and banners.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Alert from '../i18n/Alert';
import Text from '../i18n/Text';
import Animated, { Easing, FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { native, NotifStatus } from '../lib/native';
import {
  enableNotifications,
  openNotificationSettings,
  openSystemSettings,
  permission,
  requestTestPush,
} from '../remote/push';
import { control, useRemote } from '../remote/remote';
import { Theme } from '../theme';
import { type } from '../typography';
import { tr } from '../i18n/i18n';

type Check = {
  key: string;
  ok: boolean | null;
  title: string;
  text: string;
  fix?: { label: string; onPress: () => void };
};

export default function NotificationCheck({
  visible,
  theme,
  onClose,
}: {
  visible: boolean;
  theme: Theme;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const canTest =
    useRemote(s => s.config?.test_push === true) && control('test').allow;
  const [perm, setPerm] = useState<'granted' | 'denied' | null>(null);
  const [st, setSt] = useState<NotifStatus | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    permission().then(setPerm);
    native
      .notificationStatus()
      .then(setSt)
      .catch(() => setSt(null));
  }, []);
  useEffect(() => {
    if (!visible) return;
    load();
    const sub = AppState.addEventListener(
      'change',
      s => s === 'active' && load(),
    );
    return () => sub.remove();
  }, [visible, load]);

  if (!visible) return null;
  const android = Platform.OS === 'android';
  const allow = async () => {
    const r = await enableNotifications();
    if (r === 'blocked') openSystemSettings();
    load();
  };
  const checks: Check[] = [
    {
      key: 'perm',
      ok: perm === null ? null : perm === 'granted',
      title: 'Notifications allowed for Fileora',
      text:
        perm === 'granted'
          ? 'Your phone lets Fileora show notifications.'
          : 'Your phone doesn’t let Fileora show notifications yet.',
      fix: perm === 'granted' ? undefined : { label: 'Allow', onPress: allow },
    },
  ];
  if (android && st) {
    const soundOk = st.channel && st.importance >= 3 && st.sound;
    checks.push({
      key: 'channel',
      ok: st.importance === -1 ? null : soundOk,
      title: 'Sound and pop-up',
      text: soundOk
        ? '“Updates and news” plays the Fileora sound.'
        : st.importance === 0
        ? '“Updates and news” is switched off in Android’s settings.'
        : '“Updates and news” is set to silent. Turn on sound and pop-up.',
      fix: soundOk
        ? undefined
        : {
            label: 'Open',
            onPress: () => native.openNotificationFix('channel'),
          },
    });
    const battery = st.batteryOptimized || st.backgroundRestricted;
    checks.push({
      key: 'battery',
      ok:
        !st.backgroundRestricted && !st.batteryOptimized
          ? true
          : st.backgroundRestricted
          ? false
          : null,
      title: 'Battery',
      text: st.backgroundRestricted
        ? 'Fileora is restricted in the background, so notifications can’t arrive while the app is closed. Set Battery to “Unrestricted”.'
        : battery
        ? 'If notifications don’t arrive with the app closed, set Fileora’s Battery to “Unrestricted” / “No restrictions”.'
        : 'Fileora isn’t limited by battery saving.',
      fix: battery
        ? {
            label: 'Open',
            onPress: () => native.openNotificationFix('battery'),
          }
        : undefined,
    });
    if (st.autostart)
      checks.push({
        key: 'autostart',
        ok: null,
        title: 'Autostart',
        text: `On ${
          st.maker || 'this phone'
        }, apps that were swiped away get no notifications unless Autostart is allowed. Allow it for Fileora.`,
        fix: {
          label: 'Open',
          onPress: () => native.openNotificationFix('autostart'),
        },
      });
  }
  if (!android)
    checks.push({
      key: 'ios',
      ok: null,
      title: 'Sound and banners',
      text: 'iPhone Settings → Notifications → Fileora: Sounds and Banners on, and Focus modes allow Fileora.',
      fix: { label: 'Open', onPress: openNotificationSettings },
    });

  const test = async () => {
    setSending(true);
    const delay = 10;
    Alert.alert(
      'Test notification',
      tr('Go to your home screen now (or lock the phone). The test notification arrives in about {n} seconds.', { n: delay }),
    );
    const err = await requestTestPush(delay);
    setSending(false);
    if (err) Alert.alert('Test notification', err);
  };

  const icon = (ok: boolean | null): { name: IconName; color: string } =>
    ok === true
      ? { name: 'check', color: theme.accentInk }
      : ok === false
      ? { name: 'close', color: theme.danger }
      : { name: 'info', color: theme.warnInk };

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
          onPress={onClose}
          accessibilityLabel={tr('Close')}
        />
      </Animated.View>
      <Animated.View
        entering={FadeInUp.duration(300).easing(Easing.out(Easing.cubic))}
        style={[
          styles.sheet,
          { backgroundColor: theme.bg, paddingBottom: insets.bottom + 18 },
        ]}
        accessibilityViewIsModal
      >
        <ScrollView contentContainerStyle={styles.body} bounces={false}>
          <Text
            style={[type.title, { color: theme.ink }]}
            accessibilityRole="header"
          >
            Check notifications
          </Text>
          {checks.map(c => {
            const i = icon(c.ok);
            return (
              <View
                key={c.key}
                style={[
                  styles.row,
                  { backgroundColor: theme.surface, borderColor: theme.line },
                ]}
              >
                <Icon name={i.name} size={20} color={i.color} width={2.4} />
                <View style={styles.flex}>
                  <Text style={[type.heading, { color: theme.ink }]}>
                    {c.title}
                  </Text>
                  <Text style={[type.bodySm, { color: theme.muted }]}>
                    {c.text}
                  </Text>
                </View>
                {c.fix && (
                  <PressableScale
                    onPress={c.fix.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.fix.label}: ${c.title}`}
                    style={[styles.fix, { backgroundColor: theme.surface2 }]}
                  >
                    <Text style={[type.caption, { color: theme.ink }]}>
                      {c.fix.label}
                    </Text>
                  </PressableScale>
                )}
              </View>
            );
          })}
          {canTest && (
            <PressableScale
              onPress={test}
              disabled={sending || perm !== 'granted'}
              accessibilityRole="button"
              style={[
                styles.btn,
                {
                  backgroundColor:
                    perm === 'granted' ? theme.accent : theme.surface2,
                },
              ]}
            >
              {sending ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text
                  style={[
                    type.button,
                    {
                      color: perm === 'granted' ? theme.onAccent : theme.muted,
                    },
                  ]}
                >
                  Send a test notification
                </Text>
              )}
            </PressableScale>
          )}
          <PressableScale
            onPress={onClose}
            accessibilityRole="button"
            style={[styles.btn, { backgroundColor: theme.surface2 }]}
          >
            <Text style={[type.button, { color: theme.ink }]}>Done</Text>
          </PressableScale>
        </ScrollView>
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
    maxHeight: '90%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  body: { padding: 20, gap: 10 },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  fix: {
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});
