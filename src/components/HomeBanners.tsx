/**
 * Home screen banners:
 * - the announcement set in Fileora → App Center → Manage (info / offer / warning, can be closed),
 * - "Update available" when App Center → Versions has a newer version (closed per version),
 * - an invitation to turn on notifications (Android 13+ asks for permission only after "Turn on").
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { SHARE_URL } from '../config';
import { cmpVersion, remote, useRemote } from '../remote/remote';
import { enableNotifications, openLink, openSystemSettings, permission, pushAvailable } from '../remote/push';
import { brand, Theme } from '../theme';
import { type } from '../typography';
import { APP_VERSION } from '../version';

const ASK_AGAIN = 14 * 86400000;

function Banner({
  theme,
  icon,
  tone,
  title,
  text,
  action,
  onClose,
  closeLabel = 'Close',
}: {
  theme: Theme;
  icon: IconName;
  tone: 'info' | 'offer' | 'warning';
  title: string;
  text?: string;
  action?: { label: string; onPress: () => void };
  onClose?: () => void;
  closeLabel?: string;
}) {
  const c =
    tone === 'warning'
      ? { bg: theme.warnBg, line: theme.warnLine, icon: theme.warnInk }
      : tone === 'offer'
        ? { bg: theme.dark ? '#0F2E22' : '#E6F7EE', line: theme.dark ? '#1F5A3F' : '#A9E2C5', icon: theme.accentInk }
        : { bg: theme.dark ? '#0E2645' : '#E8F1FE', line: theme.dark ? '#244A7A' : '#B7D3FB', icon: theme.link };
  return (
    <Animated.View entering={FadeInDown.duration(380)} exiting={FadeOut.duration(200)} style={[styles.banner, { backgroundColor: c.bg, borderColor: c.line }]} accessibilityRole="summary">
      <Icon name={icon} size={22} color={c.icon} />
      <View style={styles.body}>
        <Text style={[type.heading, { color: theme.ink }]}>{title}</Text>
        {!!text && <Text style={[type.bodySm, { color: theme.ink2 }]}>{text}</Text>}
        {action && (
          <PressableScale onPress={action.onPress} accessibilityRole="button" style={[styles.btn, { backgroundColor: tone === 'warning' ? theme.warnInk : brand.green }]}>
            <Text style={[styles.btnText, tone === 'warning' && styles.btnTextLight]}>{action.label}</Text>
          </PressableScale>
        )}
      </View>
      {onClose && (
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={closeLabel} style={styles.close}>
          <Icon name="close" size={18} color={theme.muted} />
        </Pressable>
      )}
    </Animated.View>
  );
}

export default function HomeBanners({ theme }: { theme: Theme }) {
  const config = useRemote(s => s.config);
  const dismissed = useRemote(s => s.dismissed);
  const notify = useRemote(s => s.prefs.notify);
  const askedAt = useRemote(s => s.prefs.askedAt);
  const [perm, setPerm] = useState<'granted' | 'denied' | null>(null);

  const check = useCallback(() => {
    permission().then(setPerm);
  }, []);
  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', s => s === 'active' && check());
    return () => sub.remove();
  }, [check]);

  const ann = config?.announcement && dismissed.ann !== config.announcement.id ? config.announcement : null;
  const latest = config?.update.latest || '';
  const showUpdate = !!latest && cmpVersion(APP_VERSION, latest) < 0 && dismissed.update !== latest;
  const showNotify = (Platform.OS === 'android' || Platform.OS === 'ios') && pushAvailable() && perm === 'denied' && Date.now() - askedAt > ASK_AGAIN;

  const turnOn = async () => {
    const r = await enableNotifications();
    if (r === 'blocked') openSystemSettings();
    check();
  };

  return (
    <>
      {ann && (
        <Banner
          theme={theme}
          tone={ann.style}
          icon={ann.style === 'offer' ? 'party' : 'info'}
          title={ann.title}
          text={ann.text}
          action={ann.button && ann.link ? { label: ann.button, onPress: () => openLink(ann.link, ann.title) } : undefined}
          onClose={() => remote.dismiss('ann', ann.id)}
        />
      )}
      {showUpdate && (
        <Banner
          theme={theme}
          tone="offer"
          icon="download"
          title={`Fileora ${latest} is available`}
          text={config?.update.notes || `You have version ${APP_VERSION}. Update to get the newest tools and fixes.`}
          action={{ label: 'Update', onPress: () => Linking.openURL(config?.update.url || SHARE_URL).catch(() => {}) }}
          onClose={() => remote.dismiss('update', latest)}
          closeLabel="Not now"
        />
      )}
      {showNotify && (
        <Banner
          theme={theme}
          tone="info"
          icon="bell"
          title="Get notified about new versions and tools"
          text={notify ? 'Turn on notifications for app updates, new tools and news. You can choose which ones in Settings.' : 'Notifications are off. You can turn them on any time.'}
          action={{ label: 'Turn on', onPress: turnOn }}
          onClose={() => remote.setPrefs({ askedAt: Date.now() })}
          closeLabel="Not now"
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1, borderRadius: 18, padding: 14 },
  body: { flex: 1, gap: 4 },
  btn: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 14, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  btnText: { color: '#03213F', fontSize: 14, fontWeight: '800' },
  btnTextLight: { color: '#FFFFFF' },
  close: { padding: 2 },
});
