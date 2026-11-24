/**
 * App 1.2: one alert with everything in it — category, title, the whole message (no "…"), the
 * date and time it was sent, its image, and a button for what it points to (a tool, a page, the
 * update…). Opened from Alerts or by tapping a notification. Opening it marks it as read.
 *
 * A notification carries at most 300 characters; the website's history has the whole message, so
 * the screen refreshes the settings once when it opens and shows the full text as soon as it is in.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Text from '../i18n/Text';
import StackHeader from '../components/StackHeader';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import Skeleton from '../components/Skeleton';
import { TOPIC_ICON } from '../components/InAppBanner';
import { inbox, useInbox } from '../remote/inbox';
import { InboxItem, remote, TOPIC_LABELS } from '../remote/remote';
import { openTarget } from '../remote/push';
import { toolById } from '../data/tools';
import type { RootStackParamList } from '../navigation/types';
import { Theme } from '../theme';
import { type } from '../typography';
import { tr } from '../i18n/i18n';

/** Category name as people see it in Settings ("all" = Important). */
export function categoryName(topic: string): string {
  if (!topic || topic === 'all') return 'Important';
  return TOPIC_LABELS.find(t => t.id === topic)?.label ?? topic;
}

/** "Sunday, 22 November 2026 · 1:08 am" in the phone's own date and time format. */
export function fullDate(at: number): string {
  const d = new Date(at * 1000);
  try {
    return `${d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** The button for what an alert points to, or null when it only informs. */
export function actionOf(i: InboxItem): { label: string; icon: 'grid' | 'external' | 'download' | 'scan' | 'folder' | 'party' } | null {
  switch (i.open) {
    case 'tool':
      return i.tool && toolById(i.tool) ? { label: tr('Open {tool}', { tool: tr(toolById(i.tool)!.name) }), icon: 'grid' } : null;
    case 'link':
      return i.link ? { label: tr('Open link'), icon: 'external' } : null;
    case 'update':
      return { label: tr('Update now'), icon: 'download' };
    case 'scanner':
      return { label: tr('Open Scanner'), icon: 'scan' };
    case 'files':
      return { label: tr('Open Files'), icon: 'folder' };
    case 'promo':
      return { label: tr('See offers'), icon: 'party' };
    default:
      return null;
  }
}

export default function AlertDetailScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const { id } = useRoute<RouteProp<RootStackParamList, 'Alert'>>().params;
  const list = useInbox(); // re-renders when the history (or the full text) arrives
  const item = useMemo(() => list.find(i => i.id === id) ?? inbox.find(id), [list, id]);
  const [checking, setChecking] = useState(true);
  const [ratio, setRatio] = useState(16 / 9);

  useEffect(() => {
    inbox.markRead(id);
    let live = true;
    remote.refresh(true).finally(() => live && setChecking(false));
    return () => {
      live = false;
    };
  }, [id]);
  useEffect(() => {
    if (item?.image) Image.getSize(item.image, (w, h) => w > 0 && h > 0 && setRatio(Math.max(0.6, Math.min(2.4, w / h))), () => {});
  }, [item?.image]);

  const action = item ? actionOf(item) : null;
  const remove = () => {
    if (!item) return;
    inbox.remove(item.id);
    nav.goBack();
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title={tr('Alert')} theme={theme} onBack={() => nav.goBack()} action={item ? { icon: 'trash', label: tr('Delete alert: {title}', { title: item.title }), onPress: remove } : undefined} />
      {!item ? (
        checking ? (
          <View style={styles.content} accessibilityLabel={tr('Loading')}>
            <Skeleton theme={theme} width={120} height={26} radius={13} />
            <Skeleton theme={theme} width="85%" height={26} />
            <Skeleton theme={theme} width="100%" height={14} />
            <Skeleton theme={theme} width="95%" height={14} />
            <Skeleton theme={theme} width="60%" height={14} />
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(250)} style={[styles.content, styles.center]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.surface2 }]}>
              <Icon name="bell" size={30} color={theme.muted} />
            </View>
            <Text style={[type.heading, { color: theme.ink }]}>This alert is no longer available</Text>
            <Text style={[type.bodySm, styles.centerText, { color: theme.muted }]}>It may have been deleted or is older than the time alerts are kept.</Text>
          </Animated.View>
        )
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={FadeInDown.duration(320)} style={styles.gap}>
            <View style={[styles.chip, { backgroundColor: theme.accent + '1F' }]}>
              <Icon name={TOPIC_ICON[item.topic] ?? 'bell'} size={15} color={theme.accentInk} />
              <Text style={[type.caption, { color: theme.accentInk }]}>{categoryName(item.topic)}</Text>
            </View>
            <Text style={[type.title, { color: theme.ink }]} selectable accessibilityRole="header">
              {item.title}
            </Text>
            <View style={styles.row}>
              <Icon name="clock" size={15} color={theme.muted} />
              <Text style={[type.caption, { color: theme.muted }]}>{fullDate(item.at)}</Text>
            </View>
          </Animated.View>
          {item.image ? (
            <Animated.View entering={FadeIn.duration(400).delay(80)}>
              <Image source={{ uri: item.image }} style={[styles.image, { aspectRatio: ratio, backgroundColor: theme.surface2 }]} resizeMode="cover" accessibilityIgnoresInvertColors />
            </Animated.View>
          ) : null}
          <Animated.View entering={FadeInDown.duration(360).delay(60)}>
            {item.body ? (
              <Text style={[type.body, styles.body, { color: theme.ink2 }]} selectable>
                {item.body}
              </Text>
            ) : null}
            {checking && item.body.endsWith('…') ? (
              <View style={styles.row}>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={[type.caption, { color: theme.muted }]}>Loading the whole message…</Text>
              </View>
            ) : null}
          </Animated.View>
          {action ? (
            <Animated.View entering={FadeInDown.duration(360).delay(120)}>
              <PressableScale
                onPress={() => openTarget({ open: item.open, tool: item.tool, link: item.link })}
                accessibilityRole="button"
                style={[styles.btn, { backgroundColor: theme.accent }]}>
                <Icon name={action.icon} size={18} color={theme.onAccent} width={2.3} />
                <Text style={[type.button, { color: theme.onAccent }]}>{action.label}</Text>
              </PressableScale>
            </Animated.View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  gap: { gap: 10 },
  center: { alignItems: 'center', paddingTop: 60 },
  centerText: { textAlign: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  image: { width: '100%', borderRadius: 16 },
  body: { fontSize: 16, lineHeight: 25 },
  btn: { minHeight: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
