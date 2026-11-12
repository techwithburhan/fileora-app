/**
 * Settings: account, dark mode (kept on the phone between sessions), website pages, share the app,
 * and the footer with the Fileora logo, version and developer link.
 */
import React from 'react';
import { Linking, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import { Logo } from '../components/Brand';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { ABOUT_SLUGS, CONTACT_SLUGS, DEVELOPER, PRIVACY_SLUGS, SHARE_URL, TERMS_SLUGS } from '../config';
import { store, useStore } from '../store/store';
import { Theme } from '../theme';
import { type } from '../typography';
import { APP_VERSION } from '../version';

type Row = { key: string; icon: IconName; label: string; sub?: string; onPress?: () => void; right?: React.ReactNode; external?: boolean };

export default function SettingsScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const pref = useStore(s => s.theme);
  const page = (title: string, slugs: string[]) => () => nav.navigate('Web', { title, slugs });

  const share = () =>
    Share.share({ title: 'Fileora', message: `Fileora: free PDF, image and file tools. ${SHARE_URL}` }).catch(() => {});

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
    {
      title: 'More',
      rows: [
        { key: 'terms', icon: 'file', label: 'Terms & Conditions', onPress: page('Terms & Conditions', TERMS_SLUGS) },
        { key: 'privacy', icon: 'shield', label: 'Privacy Policy', onPress: page('Privacy Policy', PRIVACY_SLUGS) },
        { key: 'about', icon: 'info', label: 'About', onPress: page('About', ABOUT_SLUGS) },
        { key: 'contact', icon: 'mail', label: 'Contact', onPress: page('Contact', CONTACT_SLUGS) },
        { key: 'share', icon: 'share', label: 'Share application', sub: 'WhatsApp, messages, email…', onPress: share },
      ],
    },
  ];

  let n = 0;
  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <AppHeader theme={theme} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.title, { color: theme.ink }]} accessibilityRole="header">
          Settings
        </Text>
        {groups.map(g => (
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
                  <Animated.View key={r.key} entering={FadeInDown.delay(40 + n++ * 30).duration(320)}>
                    {r.onPress ? (
                      <PressableScale scaleTo={0.985} onPress={r.onPress} accessibilityRole="button" style={[styles.row, border]}>
                        {body}
                      </PressableScale>
                    ) : (
                      <View style={[styles.row, border]}>{body}</View>
                    )}
                  </Animated.View>
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
});
