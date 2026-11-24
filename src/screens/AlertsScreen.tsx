/**
 * Alerts (bottom bar): every notification Fileora sent to this install, newest first, also the
 * ones that arrived while the phone was off or notifications were muted (they come from the
 * website's history). App 1.2: each alert stays unread (dot, bold title, badge count) until it is
 * opened; tapping one opens its whole message (AlertDetailScreen). "Mark all as read" with Undo.
 * Alerts are deleted automatically after App Center's time (30 days by default), and an admin can
 * delete one or all of them. Pull down to fetch new ones from the website.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, StyleSheet, View } from 'react-native';
import Text from '../i18n/Text';

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useHeaderScroll } from '../components/headerScroll';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { inbox, useInbox, useReadState } from '../remote/inbox';
import { effectivePrefs, InboxItem, remote, useRemote } from '../remote/remote';
import { openInboxItem, permission, pushAvailable } from '../remote/push';
import { Theme } from '../theme';
import { type } from '../typography';
import Appear from '../components/Appear';
import PullRefresh from '../components/PullRefresh';
import Animated from 'react-native-reanimated';
import { tr } from '../i18n/i18n';

const TOPIC_ICON: Record<string, IconName> = {
  all: 'bell',
  updates: 'download',
  news: 'blog',
  tools: 'grid',
  offers: 'party',
  blog: 'blog',
};

function ago(at: number) {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - at);
  if (s < 60) return 'Just now';
  if (s < 3600) return tr('{n} min ago', { n: Math.floor(s / 60) });
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(at * 1000).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  });
}

export default function AlertsScreen({ theme }: { theme: Theme }) {
  useHeaderScroll();
  const nav = useNavigation();
  const items = useInbox();
  const rs = useReadState();
  const unreadOf = (i: InboxItem) => !(i.at <= rs.readBefore || rs.read.includes(i.id));
  const unreadN = items.filter(unreadOf).length;
  const prefs = useRemote(s => s.prefs);
  const hours = useRemote(s => s.config?.inbox_purge.hours ?? 720);
  const [perm, setPerm] = useState<'granted' | 'denied' | null>(null);

  useFocusEffect(
    useCallback(() => {
      remote.refresh(true).catch(() => {}); // newest history from the website (304 when nothing changed)
      inbox.takePending();
      permission().then(setPerm);
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener(
      'change',
      st => st === 'active' && permission().then(setPerm),
    );
    return () => sub.remove();
  }, []);


  // Delete one, or all with one tap; both can be undone for a few seconds
  const [undo, setUndo] = useState<{ text: string; run: () => void } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offer = (text: string, run: () => void) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ text, run });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);
  const remove = (item: InboxItem) => {
    inbox.remove(item.id);
    offer('Alert deleted', () => inbox.add(item));
  };
  const clearAll = () => {
    const n = items.length;
    const back = inbox.clearAll();
    offer(n === 1 ? '1 alert deleted' : tr('{n} alerts deleted', { n }), back);
  };
  const markAll = () => {
    const back = inbox.markAllRead();
    offer(unreadN === 1 ? tr('1 alert marked as read') : tr('{n} alerts marked as read', { n: unreadN }), back);
  };
  const off =
    pushAvailable() && (perm === 'denied' || !effectivePrefs(prefs).notify);
  const kept = hours % 24 === 0 ? (hours === 24 ? tr('1 day') : tr('{n} days', { n: hours / 24 })) : tr('{n} hours', { n: hours });

  const renderItem = ({ item, index }: { item: InboxItem; index: number }) => {
    const unread = unreadOf(item);
    return (
      <Appear delay={Math.min(index, 8) * 40} duration={320}
      >
        <PressableScale
          scaleTo={0.985}
          onPress={() => openInboxItem({ id: item.id, open: item.open, tool: item.tool, link: item.link })}
          accessibilityRole="button"
          accessibilityLabel={`${unread ? tr('Unread.') + ' ' : ''}${item.title}. ${
            item.body
          }. ${ago(item.at)}`}
          accessibilityHint={tr('Opens the whole message')}
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: unread ? theme.accent : theme.line,
            },
          ]}
        >
          <View style={[styles.icon, { backgroundColor: theme.accent + '1F' }]}>
            <Icon
              name={TOPIC_ICON[item.topic] ?? 'bell'}
              size={20}
              color={theme.accentInk}
            />
          </View>
          <View style={styles.flex}>
            <View style={styles.titleRow}>
              <Text
                style={[type.heading, styles.flex, { color: theme.ink }, !unread && styles.readTitle]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {unread && (
                <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              )}
            </View>
            {item.body ? (
              <Text
                style={[type.bodySm, { color: theme.ink2 }]}
                numberOfLines={3}
              >
                {item.body}
              </Text>
            ) : null}
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={[styles.image, { backgroundColor: theme.surface2 }]}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <Text style={[type.caption, { color: theme.muted }]}>
              {ago(item.at)} · {tr('Tap to read')}
            </Text>
          </View>
          <Pressable
            onPress={() => remove(item)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={tr('Delete alert: {title}', { title: item.title })}
            style={({ pressed }) => [styles.del, pressed && { backgroundColor: theme.surface2 }]}
          >
            <Icon name="trash" size={18} color={theme.muted} />
          </Pressable>
        </PressableScale>
      </Appear>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <PullRefresh theme={theme} onRefresh={() => remote.refresh(true)}>
        <Animated.FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.head}>
            <View style={styles.headRow}>
              <Text
                style={[type.title, styles.flex, { color: theme.ink }]}
                accessibilityRole="header"
              >
                Alerts
              </Text>
              {unreadN > 0 && (
                <PressableScale
                  onPress={markAll}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Mark all as read')}
                  style={[styles.clear, { borderColor: theme.line, backgroundColor: theme.surface }]}
                >
                  <Icon name="check" size={16} color={theme.ink2} />
                  <Text style={[type.caption, { color: theme.ink }]}>Read all</Text>
                </PressableScale>
              )}
              {items.length > 0 && (
                <PressableScale
                  onPress={clearAll}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Delete all alerts')}
                  style={[styles.clear, { borderColor: theme.line, backgroundColor: theme.surface }]}
                >
                  <Icon name="trash" size={16} color={theme.ink2} />
                  <Text style={[type.caption, { color: theme.ink }]}>Clear all</Text>
                </PressableScale>
              )}
            </View>
            <Text style={[type.bodySm, { color: theme.muted }]}>
              {tr('Updates, new tools and news from Fileora. Alerts are kept for {time}. Pull down to check for new ones.', { time: kept })}
              {unreadN > 0 ? ` ${unreadN === 1 ? tr('1 unread') : tr('{n} unread', { n: unreadN })}.` : ''}
            </Text>
            {off && (
              <PressableScale
                onPress={() => nav.navigate('Tabs', { screen: 'Settings' })}
                accessibilityRole="button"
                style={[
                  styles.offNote,
                  {
                    backgroundColor: theme.warnBg,
                    borderColor: theme.warnLine,
                  },
                ]}
              >
                <Icon name="bell" size={18} color={theme.warnInk} />
                <Text style={[type.bodySm, styles.flex, { color: theme.ink }]}>
                  Notifications are off on this phone. New alerts still appear
                  here. Turn them on in Settings.
                </Text>
                <Icon name="chevron" size={18} color={theme.warnInk} />
              </PressableScale>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View
              style={[styles.emptyIcon, { backgroundColor: theme.surface2 }]}
            >
              <Icon name="bell" size={30} color={theme.muted} />
            </View>
            <Text style={[type.heading, { color: theme.ink }]}>
              No alerts yet
            </Text>
            <Text style={[type.bodySm, styles.center, { color: theme.muted }]}>
              When Fileora sends news, new tools or app updates, you’ll find
              them here.
            </Text>
          </View>
        }
        />
      </PullRefresh>
      {undo && (
        <View style={[styles.undo, theme.dark ? { backgroundColor: theme.surface2 } : styles.undoLight]} accessibilityLiveRegion="polite">
          <Text style={[type.bodySm, styles.flex, styles.undoText]}>{undo.text}</Text>
          <Pressable
            onPress={() => {
              undo.run();
              setUndo(null);
            }}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.undoBtn}
          >
            <Text style={[type.button, styles.undoAction]}>Undo</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  del: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: -6, marginRight: -6 },
  undo: { position: 'absolute', left: 16, right: 16, bottom: 16, borderRadius: 14, paddingLeft: 16, paddingRight: 6, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  undoLight: { backgroundColor: '#04336B' },
  undoText: { color: '#FFFFFF' },
  undoBtn: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' },
  undoAction: { color: '#7BE3AE' },
  head: { gap: 6, marginBottom: 6 },
  offNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 6,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: 'flex-start',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  readTitle: { fontWeight: '500' },
  image: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 2,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  center: { textAlign: 'center' },
});
