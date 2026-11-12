import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { ToolChip } from '../components/ToolCard';
import FileRow from '../components/FileRow';
import Segmented from '../components/Segmented';
import { UsageDonut, WeekBars } from '../components/UsageCharts';
import { CATEGORIES, DEVICE_TOOL_COUNT, TOOL_COUNT } from '../data/tools';
import { getPosts, Post } from '../api/wp';
import { categoryUsage, dailyBytes, popularTools, recentTools, totals } from '../store/derive';
import { formatBytes } from '../store/files';
import { useStore } from '../store/store';
import { activityFiles } from '../store/activity';
import { openRecord } from '../lib/openFile';
import { useFileActions } from '../components/FileActions';
import { ActivityTab } from '../navigation/types';
import { brand, catColor, Theme } from '../theme';
import { type } from '../typography';

/** A soft circle that drifts very slowly in the hero (endless, UI thread; still when reduced motion is on). */
function Blob({ size, color, x, y, dx, dy, ms }: { size: number; color: string; x: number; y: number; dx: number; dy: number; ms: number }) {
  const t = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withSequence(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: ms, easing: Easing.inOut(Easing.sin) })), -1);
  }, [t, ms, reduced]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateX: dx * t.value }, { translateY: dy * t.value }, { scale: 1 + 0.04 * t.value }] }));
  return <Animated.View style={[styles.blob, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, left: x, top: y }, s]} />;
}

function Skeleton({ theme }: { theme: Theme }) {
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[styles.post, { backgroundColor: theme.surface, borderColor: theme.line }, s]}>
      <View style={[styles.postImg, { backgroundColor: theme.surface2 }]} />
      <View style={styles.postBody}>
        <View style={[styles.skLine, styles.w90, { backgroundColor: theme.surface2 }]} />
        <View style={[styles.skLine, styles.w60, { backgroundColor: theme.surface2 }]} />
      </View>
    </Animated.View>
  );
}

export default function HomeScreen({ theme }: { theme: Theme }) {
  const [showActions, actionSheet] = useFileActions(theme);
  const nav = useNavigation();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [postsError, setPostsError] = useState(false);

  const load = useCallback(() => {
    setPostsError(false);
    setPosts(null);
    getPosts(1, 3).then(setPosts).catch(() => setPostsError(true));
  }, []);
  useEffect(load, [load]);

  const events = useStore(st => st.events);
  const files = useStore(st => st.files);
  const recent = useMemo(() => recentTools(events), [events]);
  const popular = useMemo(() => popularTools(events), [events]);
  const byCat = useMemo(() => categoryUsage(events), [events]);
  const week = useMemo(() => dailyBytes(events), [events]);
  const sum = useMemo(() => totals(events), [events]);
  const [tab, setTab] = useState<ActivityTab>('downloaded');
  const lists = useMemo(() => activityFiles(files), [files]);

  const openTool = (id: string) => nav.navigate('Tool', { id });
  const section = (title: string, action?: { label: string; onPress: () => void }) => (
    <View style={styles.secHead}>
      <Text style={[type.section, { color: theme.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {action && (
        <Text style={[styles.secLink, { color: theme.link }]} onPress={action.onPress} accessibilityRole="link">
          {action.label}
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <AppHeader theme={theme} scrollY={scrollY} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={styles.hero}>
          <Blob size={190} color={brand.green} x={210} y={-70} dx={-10} dy={8} ms={7000} />
          <Blob size={120} color={brand.blue} x={-40} y={150} dx={12} dy={-6} ms={8000} />
          <Animated.Text entering={FadeInDown.delay(150).duration(500)} style={styles.kicker}>
            FREE · NO SIGN-UP · PRIVATE
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(250).duration(550)} style={styles.heroTitle}>
            Every PDF & image tool, in your pocket
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(350).duration(550)} style={styles.heroText}>
            Merge, compress, convert and edit. {DEVICE_TOOL_COUNT} tools run on your phone, so your files stay with you.
          </Animated.Text>
          <Animated.View entering={FadeInDown.delay(450).duration(550)} style={styles.heroBtns}>
            <PressableScale
              onPress={() => nav.navigate('Tabs', { screen: 'Tools', params: { cat: 'all' } })}
              accessibilityRole="button"
              style={[styles.btn, styles.btnWide, { backgroundColor: brand.green }]}>
              <Icon name="grid" size={18} color="#03213F" width={2.3} />
              <Text style={styles.btnText}>Browse by tools</Text>
            </PressableScale>
            <View style={styles.btnPair}>
              <PressableScale onPress={() => nav.navigate('Activity', { tab: 'downloaded' })} accessibilityRole="button" style={[styles.btn, styles.btnGhost, styles.flex]}>
                <Icon name="download" size={18} color="#FFFFFF" width={2.2} />
                <Text style={[styles.btnText, styles.btnGhostText]}>Downloads</Text>
              </PressableScale>
              <PressableScale onPress={() => nav.navigate('Tabs', { screen: 'Resume' })} accessibilityRole="button" style={[styles.btn, styles.btnGhost, styles.flex]}>
                <Icon name="resume" size={18} color="#FFFFFF" width={2.2} />
                <Text style={[styles.btnText, styles.btnGhostText]}>ATS Resume</Text>
              </PressableScale>
            </View>
          </Animated.View>
        </View>

        {/* Search */}
        <PressableScale
          scaleTo={0.98}
          onPress={() => nav.navigate('Tabs', { screen: 'Tools', params: { focus: Date.now() } })}
          accessibilityRole="search"
          accessibilityLabel="Search tools"
          style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Icon name="search" size={20} color={theme.muted} />
          <Text style={[styles.searchText, { color: theme.muted }]}>Search {TOOL_COUNT} tools…</Text>
        </PressableScale>

        {/* Recently used (from this phone's history) */}
        {recent.length > 0 && (
          <>
            {section('Recently used')}
            <FlatList
              horizontal
              data={recent}
              keyExtractor={t => t.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              style={styles.carouselOuter}
              renderItem={({ item }) => <ToolChip tool={item} theme={theme} onPress={() => openTool(item.id)} />}
            />
          </>
        )}

        {/* Categories */}
        {section('Categories')}
        <View style={styles.cats}>
          {CATEGORIES.map((c, i) => {
            const col = catColor(c.id, theme);
            return (
              <Animated.View key={c.id} entering={FadeInDown.delay(200 + i * 60).duration(420)} style={styles.catCell}>
                <PressableScale
                  onPress={() => nav.navigate('Tabs', { screen: 'Tools', params: { cat: c.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}, ${c.count} tools`}
                  style={[styles.cat, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                  <View style={[styles.catIcon, { backgroundColor: col + '1F' }]}>
                    <Icon name={c.id as IconName} size={22} color={col} />
                  </View>
                  <Text style={[styles.catName, { color: theme.ink }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={[styles.catCount, { color: theme.muted }]}>{c.count} tools</Text>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        {/* Popular */}
        {section(popular.personal ? 'Your most used tools' : 'Popular tools', { label: 'See all', onPress: () => nav.navigate('Tabs', { screen: 'Tools', params: { cat: 'all' } }) })}
        <FlatList
          horizontal
          data={popular.tools}
          keyExtractor={t => t.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          style={styles.carouselOuter}
          renderItem={({ item }) => <ToolChip tool={item} theme={theme} onPress={() => openTool(item.id)} />}
        />

        {/* Your files: Downloaded / Opened / Processed */}
        {section('Your files', { label: 'See all', onPress: () => nav.navigate('Activity', { tab }) })}
        <Segmented
          theme={theme}
          value={tab}
          onChange={setTab}
          items={[
            { id: 'downloaded', label: 'Downloaded', count: lists.downloaded.length },
            { id: 'opened', label: 'Opened', count: lists.opened.length },
            { id: 'processed', label: 'Processed', count: lists.processed.length },
          ]}
        />
        {lists[tab].length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Icon name={tab === 'opened' ? 'clock' : tab === 'downloaded' ? 'download' : 'check'} size={22} color={theme.muted} />
            <Text style={[type.bodySm, styles.flex, { color: theme.muted }]}>
              {tab === 'downloaded'
                ? 'Files you download from a tool show up here.'
                : tab === 'opened'
                  ? 'Files you open from Fileora show up here.'
                  : 'Files you merge, compress or convert in the app show up here.'}
            </Text>
          </View>
        ) : (
          lists[tab].slice(0, 3).map(f => (
            <FileRow key={f.id} file={f} theme={theme} when={tab === 'opened' ? 'opened' : 'created'} onPress={() => openRecord(f)} onMore={() => showActions(f)} />
          ))
        )}

        {/* Usage, from this phone's history only */}
        {section('Your activity')}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          {sum.tasks === 0 && byCat.length === 0 ? (
            <View style={styles.emptyChart}>
              <Icon name="pulse" size={26} color={theme.muted} />
              <Text style={[type.heading, { color: theme.ink }]}>No activity yet</Text>
              <Text style={[type.bodySm, styles.centerText, { color: theme.muted }]}>
                Use a tool and your charts appear here. They come from the history kept on this phone.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[type.overline, { color: theme.muted }]}>TOOLS USED, BY CATEGORY</Text>
              {byCat.length > 0 ? (
                <UsageDonut data={byCat} theme={theme} />
              ) : (
                <Text style={[type.bodySm, { color: theme.muted }]}>No tools opened yet.</Text>
              )}
              <View style={[styles.divider, { backgroundColor: theme.line }]} />
              <View style={styles.statRow}>
                <Text style={[type.overline, styles.flex, { color: theme.muted }]}>PROCESSED, LAST 7 DAYS</Text>
                <Text style={[type.heading, { color: theme.ink }]}>{formatBytes(week.reduce((a, d) => a + d.bytes, 0))}</Text>
              </View>
              <WeekBars data={week} theme={theme} />
              <Text style={[type.caption, { color: theme.muted }]}>
                All time: {sum.tasks} {sum.tasks === 1 ? 'file' : 'files'} done · {formatBytes(sum.bytes)}
              </Text>
            </>
          )}
        </View>

        {/* Resume promo */}
        <Animated.View entering={FadeInDown.delay(300).duration(450)}>
          <PressableScale
            scaleTo={0.98}
            onPress={() => nav.navigate('Tabs', { screen: 'Resume' })}
            accessibilityRole="button"
            style={[styles.promo, theme.dark ? styles.promoDark : styles.promoLight]}>
            <View style={[styles.catIcon, { backgroundColor: brand.green }]}>
              <Icon name="resume" size={22} color="#fff" />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.promoTitle, { color: theme.ink }]}>ATS Resume Builder</Text>
              <Text style={[styles.promoText, { color: theme.ink2 }]}>4 templates, live PDF preview and an ATS check. Nothing is uploaded.</Text>
            </View>
            <Icon name="chevron" size={20} color={theme.ink2} />
          </PressableScale>
        </Animated.View>

        {/* Blog */}
        {section('From the blog', { label: 'All posts', onPress: () => nav.navigate('Blog') })}
        {posts === null && !postsError && [0, 1].map(i => <Skeleton key={i} theme={theme} />)}
        {postsError && (
          <Text style={[styles.err, { color: theme.muted }]} onPress={load}>
            Posts couldn’t load. <Text style={{ color: theme.link }}>Try again</Text>
          </Text>
        )}
        {posts?.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.delay(i * 80).duration(400)}>
            <PressableScale
              scaleTo={0.98}
              onPress={() => nav.navigate('Web', { url: p.link, title: 'Blog' })}
              accessibilityRole="link"
              accessibilityLabel={p.title}
              style={[styles.post, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              {p.image ? <Image source={{ uri: p.image }} style={styles.postImg} /> : <View style={[styles.postImg, { backgroundColor: theme.surface2 }]} />}
              <View style={styles.postBody}>
                <Text style={[styles.postTitle, { color: theme.ink }]} numberOfLines={3}>
                  {p.title}
                </Text>
                <Text style={[styles.postDate, { color: theme.muted }]}>
                  {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            </PressableScale>
          </Animated.View>
        ))}
      </Animated.ScrollView>
      {actionSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  hero: { backgroundColor: brand.navy, borderRadius: 24, padding: 20, paddingTop: 22, overflow: 'hidden', gap: 10 },
  blob: { position: 'absolute', opacity: 0.85 },
  kicker: { color: '#9FE3C1', fontSize: 11.5, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { color: '#FFFFFF', fontSize: 23, lineHeight: 29, fontWeight: '800', maxWidth: '90%' },
  heroText: { color: '#D3E2F5', fontSize: 14, lineHeight: 20, maxWidth: '95%' },
  heroBtns: { gap: 10, marginTop: 6 },
  btnPair: { flexDirection: 'row', gap: 10 },
  btn: { minHeight: 46, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnWide: { alignSelf: 'stretch' },
  btnText: { color: '#03213F', fontSize: 14.5, fontWeight: '800' },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  btnGhostText: { color: '#FFFFFF' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 52 },
  searchText: { fontSize: 15.5 },
  secHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 },
  secLink: { fontSize: 14, fontWeight: '700', padding: 4 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCell: { width: '48.5%' },
  cat: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 4 },
  catIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  catName: { fontSize: 14.5, fontWeight: '800' },
  catCount: { fontSize: 12.5, fontWeight: '600' },
  carouselOuter: { marginHorizontal: -16 },
  carousel: { paddingHorizontal: 16, gap: 10 },
  promo: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  promoTitle: { fontSize: 16, fontWeight: '800' },
  promoText: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  post: { flexDirection: 'row', borderWidth: 1, borderRadius: 18, overflow: 'hidden', minHeight: 96 },
  postImg: { width: 112, minHeight: 96 },
  postBody: { flex: 1, padding: 12, gap: 6, justifyContent: 'center' },
  postTitle: { fontSize: 14.5, fontWeight: '700', lineHeight: 20 },
  postDate: { fontSize: 12.5, fontWeight: '600' },
  skLine: { height: 12, borderRadius: 6 },
  w90: { width: '90%' },
  w60: { width: '60%' },
  promoLight: { backgroundColor: '#E3F7EC', borderColor: '#BDE9D2' },
  promoDark: { backgroundColor: '#0F3B2A', borderColor: '#1C5C42' },
  err: { fontSize: 14.5, textAlign: 'center', padding: 8 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  emptyChart: { alignItems: 'center', gap: 6, paddingVertical: 10 },
  centerText: { textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
