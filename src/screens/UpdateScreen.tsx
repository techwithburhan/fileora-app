/**
 * App 1.2.2: Settings → App updates. Shows the version installed on this phone next to the newest
 * version published in App Center, whether an update is available or required, what is new, and
 * when the website was last asked. Opening the screen checks again; "Check again" does too.
 *
 * After an update the screen (and a one-time note) says "Updated from 1.2.0 to 1.2.2": the new
 * version re-reads App Center at first launch (remote.load), so the versions shown are never the
 * ones saved by the old version.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Text from '../i18n/Text';
import StackHeader from '../components/StackHeader';
import Icon, { type IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { buildNumber, remote, updateState, useRemote, type UpdateState } from '../remote/remote';
import { APP_VERSION } from '../version';
import { SHARE_URL } from '../config';
import { Theme } from '../theme';
import { type } from '../typography';
import { tr } from '../i18n/i18n';

/** "just now", "5 min ago", "2 h ago", or the date. */
export function agoText(ms: number, now = Date.now()): string {
  if (!ms) return tr('never');
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return tr('just now');
  if (s < 3600) return tr('{n} min ago', { n: Math.round(s / 60) });
  if (s < 86400) return tr('{n} h ago', { n: Math.round(s / 3600) });
  try {
    return new Date(ms).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

const LOOK: Record<UpdateState | 'offline', { icon: IconName; title: string }> = {
  latest: { icon: 'check', title: 'You’re up to date' },
  available: { icon: 'download', title: 'Update available' },
  required: { icon: 'info', title: 'Update required' },
  unknown: { icon: 'refresh', title: 'Not checked yet' },
  offline: { icon: 'cloud', title: 'Couldn’t check for updates' },
};

export default function UpdateScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const config = useRemote(s => s.config);
  const fetchedAt = useRemote(s => s.fetchedAt);
  const updated = useRemote(s => s.updated);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const err = await remote.refresh(true);
    setFailed(!!err);
    setChecking(false);
  }, []);
  useEffect(() => {
    check();
  }, [check]);
  // the "Updated to …" note counts as seen once this screen showed it
  useEffect(() => {
    if (updated && !updated.seen) remote.seenUpdated();
  }, [updated]);

  const u = config?.update;
  const st = updateState(APP_VERSION, u);
  const look = LOOK[failed && st === 'unknown' ? 'offline' : st];
  const latest = u?.latest || '';
  const tone =
    st === 'required'
      ? { bg: theme.warnBg, line: theme.warnLine, ink: theme.warnInk }
      : st === 'available'
        ? { bg: theme.accent + '1F', line: theme.accent + '55', ink: theme.accentInk }
        : { bg: theme.surface, line: theme.line, ink: theme.ink };
  const open = () => Linking.openURL(u?.url || SHARE_URL).catch(() => {});
  const showUpdated = !!updated && updated.to === APP_VERSION && Date.now() - updated.at < 14 * 86400000;

  const row = (label: string, value: string, sub?: string) => (
    <View style={[styles.row, { borderColor: theme.line }]}>
      <Text style={[type.bodySm, styles.rowLabel, { color: theme.muted }]}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={[type.body, styles.rowValue, { color: theme.ink }]} selectable>
          {value}
        </Text>
        {sub ? <Text style={[type.caption, { color: theme.muted }]}>{sub}</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title={tr('App updates')} theme={theme} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {showUpdated && (
          <Animated.View entering={FadeIn.duration(300)} style={[styles.note, { backgroundColor: theme.accent + '1F', borderColor: theme.accent + '55' }]} accessibilityRole="summary">
            <Icon name="party" size={20} color={theme.accentInk} />
            <Text style={[type.bodySm, styles.flex, { color: theme.ink }]}>
              {updated!.from ? tr('Fileora was updated from {from} to {to}.', { from: updated!.from, to: updated!.to }) : tr('Fileora was updated to {to}.', { to: updated!.to })}
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.duration(320)} style={[styles.status, { backgroundColor: tone.bg, borderColor: tone.line }]} accessibilityLiveRegion="polite">
          <View style={[styles.statusIcon, { backgroundColor: theme.surface2 }]}>
            {checking ? <ActivityIndicator color={theme.accent} /> : <Icon name={look.icon} size={26} color={st === 'required' ? theme.warnInk : theme.accentInk} width={2.2} />}
          </View>
          <Text style={[type.heading, { color: tone.ink }]} accessibilityRole="header">
            {checking ? 'Checking for updates…' : look.title}
          </Text>
          <Text style={[type.bodySm, styles.center, { color: theme.ink2 }]}>
            {st === 'available'
              ? tr('Fileora {v} is available. You have version {have}.', { v: latest, have: APP_VERSION })
              : st === 'required'
                ? tr('This version ({version}) is no longer supported. Install version {required} or later to keep using the app. Your files stay on this phone.', { version: APP_VERSION, required: u?.min || latest })
                : st === 'latest'
                  ? tr('Fileora {v} is the newest version.', { v: APP_VERSION })
                  : 'Connect to the internet and check again.'}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(340).delay(40)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {row(tr('Installed version'), APP_VERSION, tr('Build {n}', { n: buildNumber(APP_VERSION) }))}
          {row(tr('Latest version'), latest || (u ? APP_VERSION : '—'), latest ? undefined : u ? tr('No newer version is published') : undefined)}
          {u?.min && u.force ? row(tr('Minimum supported'), u.min) : null}
          {row(tr('Last checked'), checking ? tr('Checking…') : agoText(fetchedAt))}
        </Animated.View>

        {(st === 'available' || st === 'required') && !!u?.notes && (
          <Animated.View entering={FadeInDown.duration(360).delay(80)} style={[styles.card, styles.notes, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[type.overline, { color: theme.muted }]}>{tr('WHAT’S NEW')}</Text>
            <Text style={[type.body, { color: theme.ink2 }]} selectable>
              {u.notes}
            </Text>
          </Animated.View>
        )}

        {(st === 'available' || st === 'required') && (
          <PressableScale onPress={open} accessibilityRole="button" style={[styles.btn, { backgroundColor: theme.accent }]}>
            <Icon name="download" size={18} color={theme.onAccent} width={2.3} />
            <Text style={[type.button, { color: theme.onAccent }]}>{tr('Update to {v}', { v: (st === 'required' && u?.min && !latest ? u.min : latest) || '' })}</Text>
          </PressableScale>
        )}
        <PressableScale onPress={checking ? undefined : check} disabled={checking} accessibilityRole="button" style={[styles.btn, styles.ghost, { borderColor: theme.line, backgroundColor: theme.surface }]}>
          <Icon name="refresh" size={18} color={theme.ink} width={2.3} />
          <Text style={[type.button, { color: theme.ink }]}>{checking ? 'Checking…' : 'Check again'}</Text>
        </PressableScale>
        {failed && !checking && (
          <Text style={[type.caption, styles.center, { color: theme.muted }]}>{tr('Couldn’t refresh. Showing saved info.')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  center: { textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  status: { alignItems: 'center', gap: 8, padding: 20, borderRadius: 18, borderWidth: 1 },
  statusIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  notes: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { flexShrink: 1 },
  rowRight: { alignItems: 'flex-end', flexShrink: 1 },
  rowValue: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  btn: { minHeight: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  ghost: { borderWidth: 1 },
});
