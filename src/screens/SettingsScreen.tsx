/**
 * Settings: account, dark mode (kept on the phone between sessions), notifications and their
 * categories (App Center can lock any of them: then they are hidden), "Check notifications",
 * ads & privacy, anonymous usage, website pages (links can be changed in Fileora → App Center),
 * share the app, check for updates, and the footer with the Fileora logo, version and developer link.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { Logo } from '../components/Brand';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { ABOUT_SLUGS, CONTACT_SLUGS, DEVELOPER, PRIVACY_SLUGS, SHARE_URL, TERMS_SLUGS } from '../config';
import { store, useStore } from '../store/store';
import { cmpVersion, control, effectivePrefs, remote, TOPIC_LABELS, useRemote } from '../remote/remote';
import NotificationCheck from '../components/NotificationCheck';
import RewardSheet, { untilText } from '../ads/RewardSheet';
import { rewardHours, showPrivacyOptions, unitFor, useAdFreeUntil, usePrivacyOptions } from '../ads/ads';
import {
  disableNotifications,
  enableNotifications,
  openLink,
  openNotificationSettings,
  openSystemSettings,
  permission,
  pushAvailable,
  resetNotifications,
  syncTopics,
} from '../remote/push';
import { telemetry } from '../remote/telemetry';
import { setAnalyticsEnabled } from '../analytics';
import { Theme } from '../theme';
import { type } from '../typography';
import { APP_VERSION } from '../version';
import Appear from '../components/Appear';

type Row = { key: string; icon: IconName; label: string; sub?: string; onPress?: () => void; right?: React.ReactNode; external?: boolean };

export default function SettingsScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const pref = useStore(s => s.theme);
  const config = useRemote(s => s.config);
  const prefs = useRemote(s => s.prefs);
  const [perm, setPerm] = useState<'granted' | 'denied' | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const adFreeUntil = useAdFreeUntil();
  const privacyChoices = usePrivacyOptions();
  const check = useCallback(() => {
    permission().then(setPerm);
  }, []);
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        check();
        syncTopics();
      }
    });
    return () => sub.remove();
  }, [check]);

  const links = config?.links;
  // A link set in App Center wins; otherwise the page is found on the website by its slug.
  const page = (title: string, slugs: string[], url?: string) => () => (url ? openLink(url, title) : nav.navigate('Web', { title, slugs }));
  const shareUrl = links?.share || SHARE_URL;
  const share = () =>
    Share.share({ title: 'Fileora', message: `${links?.share_text || 'Fileora: free PDF, image and file tools.'} ${shareUrl}` }).catch(() => {});

  // App Center → Notifications → Notification & Privacy settings: locked options are hidden
  const eff = effectivePrefs(prefs);
  const can = (k: Parameters<typeof control>[0]) => control(k).allow;
  const notifLocked = !can('notify');
  const notifOn = eff.notify && perm === 'granted';
  const blocked = eff.notify && perm === 'denied' && (prefs.askedAt > 0 || notifLocked);
  const setNotif = async (v: boolean) => {
    if (!v) {
      await disableNotifications();
      return;
    }
    const r = await enableNotifications();
    check();
    if (r === 'blocked')
      Alert.alert('Notifications are blocked', 'Allow notifications for Fileora in your phone’s settings, then come back.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: openSystemSettings },
      ]);
  };
  const confirmReset = () =>
    Alert.alert('Reset notification settings?', 'Categories, quiet mode and privacy go back to their original settings, and Fileora gets a new anonymous notification ID.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          resetNotifications().then(() => {
            check();
            Alert.alert('Done', 'Notification settings were reset.');
          });
        },
      },
    ]);
  const offered = TOPIC_LABELS.filter(t => !config?.topics?.length || config.topics.includes(t.id));

  const checkUpdates = async () => {
    setChecking(true);
    const err = await remote.refresh(true);
    setChecking(false);
    const latest = remote.get().config?.update.latest;
    if (err) Alert.alert('Couldn’t check for updates', 'Check your internet connection and try again.');
    else if (latest && cmpVersion(APP_VERSION, latest) < 0)
      Alert.alert(`Fileora ${latest} is available`, remote.get().config?.update.notes || `You have version ${APP_VERSION}.`, [
        { text: 'Later', style: 'cancel' },
        { text: 'Update', onPress: () => Linking.openURL(remote.get().config?.update.url || SHARE_URL).catch(() => {}) },
      ]);
    else Alert.alert('You’re up to date', `Fileora ${APP_VERSION} is the newest version.`);
  };
  const sw = (value: boolean, onChange: (v: boolean) => void, label: string) => (
    <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.accent, false: theme.line }} thumbColor="#fff" accessibilityLabel={label} />
  );

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: 'Account',
      rows: [{ key: 'plan', icon: 'user', label: 'Free plan', sub: 'Currently free to use. No sign-in needed.' }],
    },
    {
      title: 'Appearance',
      rows: [
        {
          key: 'dark',
          icon: 'moon',
          label: 'Dark mode',
          sub: pref === 'system' ? 'Following your phone’s setting' : 'Saved on this phone',
          right: (
            <Switch
              value={theme.dark}
              onValueChange={v => store.setTheme(v ? 'dark' : 'light')}
              trackColor={{ true: theme.accent, false: theme.line }}
              thumbColor="#fff"
              accessibilityLabel="Dark mode"
            />
          ),
        },
        ...(pref !== 'system'
          ? [{ key: 'sys', icon: 'phone' as IconName, label: 'Use phone setting', sub: 'Light or dark, like the rest of your phone', onPress: () => store.setTheme('system') }]
          : []),
      ],
    },
    ...((Platform.OS === 'android' || Platform.OS === 'ios') && pushAvailable()
      ? [
          {
            title: 'Notifications & privacy',
            rows: [
              notifLocked
                ? {
                    key: 'notif',
                    icon: 'bell' as IconName,
                    label: 'Notifications',
                    sub: !eff.notify
                      ? 'Switched off for this app'
                      : notifOn
                        ? 'On: app updates, new tools and news'
                        : 'Allow notifications for Fileora on this phone. Tap to allow.',
                    onPress: eff.notify && !notifOn ? () => (blocked ? openSystemSettings() : setNotif(true)) : undefined,
                  }
                : {
                    key: 'notif',
                    icon: 'bell' as IconName,
                    label: 'Notifications',
                    sub: blocked ? 'Blocked in your phone’s settings. Tap to open them.' : notifOn ? 'On: app updates, new tools and news' : 'Off: no notifications from Fileora',
                    onPress: blocked ? openSystemSettings : undefined,
                    right: blocked ? undefined : sw(notifOn, setNotif, 'Notifications'),
                  },
              ...(notifOn
                ? [
                    ...(can('quiet')
                      ? [
                          {
                            key: 'quiet',
                            icon: 'moon' as IconName,
                            label: 'Quiet notifications',
                            sub: 'Hide pop-ups and sound: notifications arrive silently in the notification list',
                            right: sw(prefs.quiet, v => {
                              remote.setPrefs({ quiet: v });
                              syncTopics();
                            }, 'Quiet notifications'),
                          },
                        ]
                      : []),
                    ...(can('private')
                      ? [
                          Platform.OS === 'ios'
                            ? {
                                key: 'private',
                                icon: 'lock' as IconName,
                                label: 'Notification privacy',
                                sub: 'On iPhone: Settings → Notifications → Fileora → Show Previews → “When Unlocked” or “Never”',
                                onPress: () =>
                                  Alert.alert('Notification privacy', 'iPhone decides what shows on the lock screen. Open Settings → Notifications → Fileora → Show Previews and choose “When Unlocked” or “Never”.', [
                                    { text: 'Not now', style: 'cancel' },
                                    { text: 'Open Settings', onPress: openSystemSettings },
                                  ]),
                              }
                            : {
                                key: 'private',
                                icon: 'lock' as IconName,
                                label: 'Notification privacy',
                                sub: 'Nothing from Fileora on the lock screen: you see notifications after unlocking',
                                right: sw(prefs.private, v => {
                                  remote.setPrefs({ private: v });
                                  syncTopics();
                                }, 'Notification privacy'),
                              },
                        ]
                      : []),
                    ...(can('topics')
                      ? offered.map(t => ({
                          key: 'topic-' + t.id,
                          icon: 'check' as IconName,
                          label: t.label,
                          right: sw(prefs.topics[t.id] !== false, v => {
                            remote.setTopic(t.id, v);
                            syncTopics();
                          }, t.label),
                        }))
                      : []),
                  ]
                : []),
              ...(eff.notify
                ? [
                    {
                      key: 'check',
                      icon: 'pulse' as IconName,
                      label: 'Check notifications',
                      sub: 'Not arriving, or no sound? See what to change on this phone, and send a test',
                      onPress: () => setCheckOpen(true),
                    },
                    {
                      key: 'sound',
                      icon: 'settings' as IconName,
                      label: 'Sound and more',
                      sub: Platform.OS === 'ios' ? 'iPhone settings for Fileora: sound, banners, lock screen' : 'Android’s notification settings for Fileora: sound, vibration, lock screen',
                      onPress: openNotificationSettings,
                    },
                  ]
                : []),
              ...(can('reset')
                ? [
                    {
                      key: 'reset',
                      icon: 'refresh' as IconName,
                      label: 'Reset notification settings',
                      sub: 'Back to the original choices, with a new anonymous notification ID',
                      onPress: confirmReset,
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
    // App Center → Ads: only when ads are on
    ...(config?.ads?.on
      ? [
          {
            title: 'Ads & privacy',
            rows: [
              ...(adFreeUntil
                ? [{ key: 'adfree', icon: 'clock' as IconName, label: 'No ads right now', sub: `Ad-free until ${untilText(adFreeUntil)}` }]
                : unitFor('reward_adfree')
                  ? [
                      {
                        key: 'adfree',
                        icon: 'clock' as IconName,
                        label: `${rewardHours()} hours without ads`,
                        sub: 'Watch one short video',
                        onPress: () => setRewardOpen(true),
                        right: (
                          <PressableScale onPress={() => setRewardOpen(true)} accessibilityRole="button" accessibilityLabel="Watch a video for hours without ads" style={[styles.pill, { backgroundColor: theme.accent }]}>
                            <Text style={[type.caption, { color: theme.onAccent }]}>Watch</Text>
                          </PressableScale>
                        ),
                      },
                    ]
                  : []),
              ...(privacyChoices
                ? [{ key: 'adprivacy', icon: 'shield' as IconName, label: 'Privacy choices', sub: 'Choose how Google uses data for ads', onPress: () => showPrivacyOptions() }]
                : []),
              { key: 'adwhy', icon: 'info' as IconName, label: 'Why you see ads', sub: 'Ads keep every Fileora tool free, with no sign-up. Your files are never used for ads.' },
            ],
          },
        ]
      : []),
    {
      title: 'Privacy',
      rows: can('usage')
        ? [
            {
              key: 'usage',
              icon: 'pulse',
              label: 'Share anonymous usage',
              sub: 'Which tools are used and errors, with a random ID (also Firebase Analytics). No names, phone numbers or file names. Helps us fix problems.',
              right: sw(prefs.usage, v => {
                remote.setPrefs({ usage: v });
                setAnalyticsEnabled(v);
                if (!v) telemetry.clear();
              }, 'Share anonymous usage'),
            },
          ]
        : [],
    },
    {
      title: 'More',
      rows: [
        { key: 'terms', icon: 'file', label: 'Terms & Conditions', onPress: page('Terms & Conditions', TERMS_SLUGS, links?.terms) },
        { key: 'privacy', icon: 'shield', label: 'Privacy Policy', onPress: page('Privacy Policy', PRIVACY_SLUGS, links?.privacy) },
        { key: 'about', icon: 'info', label: 'About', onPress: page('About', ABOUT_SLUGS) },
        { key: 'contact', icon: 'mail', label: 'Contact', onPress: page('Contact', CONTACT_SLUGS, links?.contact) },
        { key: 'share', icon: 'share', label: 'Share application', sub: 'WhatsApp, messages, email…', onPress: share },
        { key: 'update', icon: 'refresh', label: checking ? 'Checking…' : 'Check for updates', sub: `Version ${APP_VERSION}`, onPress: checking ? undefined : checkUpdates },
      ],
    },
  ];

  let n = 0;
  const shown = groups.filter(g => g.rows.length > 0);
  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <AppHeader theme={theme} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.title, { color: theme.ink }]} accessibilityRole="header">
          Settings
        </Text>
        {shown.map(g => (
          <View key={g.title} style={styles.group}>
            <Text style={[type.overline, { color: theme.muted }]} accessibilityRole="header">
              {g.title.toUpperCase()}
            </Text>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              {g.rows.map((r, i) => {
                const body = (
                  <>
                    <View style={[styles.icon, { backgroundColor: theme.accent + '1F' }]}>
                      <Icon name={r.icon} size={19} color={theme.accentInk} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[type.heading, { color: theme.ink }]}>{r.label}</Text>
                      {r.sub ? <Text style={[type.bodySm, { color: theme.muted }]}>{r.sub}</Text> : null}
                    </View>
                    {r.right ?? (r.onPress ? <Icon name="chevron" size={18} color={theme.muted} /> : null)}
                  </>
                );
                const border = i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line } : null;
                return (
                  <Appear key={r.key} delay={40 + n++ * 30} duration={320}>
                    {r.onPress ? (
                      <PressableScale scaleTo={0.985} onPress={r.onPress} accessibilityRole="button" style={[styles.row, border]}>
                        {body}
                      </PressableScale>
                    ) : (
                      <View style={[styles.row, border]}>{body}</View>
                    )}
                  </Appear>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Logo height={30} onDark={theme.dark} />
          <Text style={[type.caption, { color: theme.muted }]}>Version {APP_VERSION}</Text>
          <Text
            style={[type.caption, { color: theme.muted }]}
            onPress={() => Linking.openURL(DEVELOPER.url)}
            accessibilityRole="link"
            accessibilityHint="Opens www.techdeployers.com">
            Developed by <Text style={[styles.link, { color: theme.link }]}>{DEVELOPER.handle}</Text>
          </Text>
        </View>
      </ScrollView>
      <NotificationCheck visible={checkOpen} theme={theme} onClose={() => setCheckOpen(false)} />
      <RewardSheet visible={rewardOpen} theme={theme} onClose={() => setRewardOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 18, paddingBottom: 32 },
  group: { gap: 8 },
  card: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 60 },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 12 },
  link: { textDecorationLine: 'underline' },
  pill: { minHeight: 40, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
