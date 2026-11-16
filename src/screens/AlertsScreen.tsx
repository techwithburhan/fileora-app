/**
 * Alerts (bottom bar): every notification Fileora sent to this install, newest first, also the
 * ones that arrived while the phone was off or notifications were muted. Opening this screen
 * clears the unread badge; the history stays (the last 60 days from App Center, plus those
 * received on this phone). Tapping an alert opens what it points to.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { inbox, useInbox } from '../remote/inbox';
import { effectivePrefs, InboxItem, remote, useRemote } from '../remote/remote';
import { openInboxItem, permission, pushAvailable } from '../remote/push';
import { Theme } from '../theme';
import { type } from '../typography';

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
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(at * 1000).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  });
}

export default function AlertsScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const focused = useIsFocused(); // tabs stay mounted: only the visible screen marks alerts as read
  const items = useInbox();
  const prefs = useRemote(s => s.prefs);
  const [refreshing, setRefreshing] = useState(false);
  const [perm, setPerm] = useState<'granted' | 'denied' | null>(null);
  // what was unread when the screen opened keeps its dot during this visit
  const lastSeen = useRef(inbox.seenAt());

  useFocusEffect(
    useCallback(() => {
      lastSeen.current = inbox.seenAt();
      remote.refresh().catch(() => {});
      inbox.markSeen();
      permission().then(setPerm);
      return () => inbox.markSeen();
    }, []),
  );
  useEffect(() => {
    // new alerts arriving while the screen is on top count as read
    if (focused && items.length) inbox.markSeen();
  }, [items, focused]);
  useEffect(() => {
    const sub = AppState.addEventListener(
      'change',
      st => st === 'active' && permission().then(setPerm),
    );
    return () => sub.remove();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await remote.refresh(true);
    setRefreshing(false);
  };
  const off =
    pushAvailable() && (perm === 'denied' || !effectivePrefs(prefs).notify);

  const renderItem = ({ item, index }: { item: InboxItem; index: number }) => {
    const unread = item.at > lastSeen.current;
    const canOpen = item.open !== 'home' || !!item.link;
    return (
      <Animated.View
        entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(320)}
      >
        <PressableScale
          scaleTo={0.985}
          onPress={canOpen ? () => openInboxItem(item) : undefined}
          disabled={!canOpen}
          accessibilityRole={canOpen ? 'button' : 'text'}
          accessibilityLabel={`${unread ? 'New. ' : ''}${item.title}. ${
            item.body
          }. ${ago(item.at)}`}
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
                style={[type.heading, styles.flex, { color: theme.ink }]}
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
                numberOfLines={4}
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
              {ago(item.at)}
              {canOpen ? ' · Tap to open' : ''}
            </Text>
          </View>
        </PressableScale>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <AppHeader theme={theme} />
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
        ListHeaderComponent={
          <View style={styles.head}>
            <Text
              style={[type.title, { color: theme.ink }]}
              accessibilityRole="header"
            >
              Alerts
            </Text>
            <Text style={[type.bodySm, { color: theme.muted }]}>
              Updates, new tools and news from Fileora. Pull down to check for
              new ones.
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
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
