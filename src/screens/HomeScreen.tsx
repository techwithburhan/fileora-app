import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { ToolChip } from '../components/ToolCard';
import { CATEGORIES, DEVICE_TOOL_COUNT, POPULAR, TOOL_COUNT } from '../data/tools';
import { getPosts, Post } from '../api/wp';
import { brand, catColor, Theme } from '../theme';

/** A soft circle that drifts slowly in the hero (endless, UI thread). */
function Blob({ size, color, x, y, dx, dy, ms }: { size: number; color: string; x: number; y: number; dx: number; dy: number; ms: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withSequence(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: ms, easing: Easing.inOut(Easing.sin) })), -1);
  }, [t, ms]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateX: dx * t.value }, { translateY: dy * t.value }, { scale: 1 + 0.08 * t.value }] }));
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
        <View style={[styles.skLine, { backgroundColor: theme.surface2, width: '90%' }]} />
        <View style={[styles.skLine, { backgroundColor: theme.surface2, width: '60%' }]} />
      </View>
    </Animated.View>
  );
}

export default function HomeScreen({ theme }: { theme: Theme }) {
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

  const openTool = (id: string) => nav.navigate('Tool', { id });
  const section = (title: string, action?: { label: string; onPress: () => void }) => (
    <View style={styles.secHead}>
      <Text style={[styles.secTitle, { color: theme.ink }]} accessibilityRole="header">
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
          <Blob size={190} color={brand.green} x={210} y={-70} dx={-18} dy={14} ms={4200} />
          <Blob size={120} color={brand.blue} x={-40} y={150} dx={22} dy={-10} ms={5200} />
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
              style={[styles.btn, { backgroundColor: brand.green }]}>
              <Text style={styles.btnText}>Browse {TOOL_COUNT} tools</Text>
            </PressableScale>
            <PressableScale onPress={() => nav.navigate('Tabs', { screen: 'Resume' })} accessibilityRole="button" style={[styles.btn, styles.btnGhost]}>
              <Text style={[styles.btnText, styles.btnGhostText]}>ATS Resume</Text>
            </PressableScale>
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
        {section('Popular tools', { label: 'See all', onPress: () => nav.navigate('Tabs', { screen: 'Tools', params: { cat: 'all' } }) })}
        <FlatList
          horizontal
          data={POPULAR}
          keyExtractor={t => t.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          style={styles.carouselOuter}
          renderItem={({ item }) => <ToolChip tool={item} theme={theme} onPress={() => openTool(item.id)} />}
        />

        {/* Resume promo */}
        <Animated.View entering={FadeInDown.delay(300).duration(450)}>
          <PressableScale
            scaleTo={0.98}
            onPress={() => nav.navigate('Tabs', { screen: 'Resume' })}
            accessibilityRole="button"
            style={[styles.promo, { backgroundColor: theme.dark ? '#0F3B2A' : '#E3F7EC', borderColor: theme.dark ? '#1C5C42' : '#BDE9D2' }]}>
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
        {section('From the blog', { label: 'All posts', onPress: () => nav.navigate('Tabs', { screen: 'Blog' }) })}
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  hero: { backgroundColor: brand.navy, borderRadius: 24, padding: 20, paddingTop: 22, overflow: 'hidden', gap: 10 },
  blob: { position: 'absolute', opacity: 0.85 },
  kicker: { color: '#9FE3C1', fontSize: 11.5, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '800', maxWidth: '88%' },
  heroText: { color: '#D3E2F5', fontSize: 14.5, lineHeight: 21, maxWidth: '95%' },
  heroBtns: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  btn: { minHeight: 46, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#03213F', fontSize: 15, fontWeight: '800' },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  btnGhostText: { color: '#FFFFFF' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 52 },
  searchText: { fontSize: 15.5 },
  secHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 },
  secTitle: { fontSize: 19, fontWeight: '800' },
  secLink: { fontSize: 14, fontWeight: '700', padding: 4 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCell: { width: '48.5%' },
  cat: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 4 },
  catIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  catName: { fontSize: 15, fontWeight: '800' },
  catCount: { fontSize: 13, fontWeight: '600' },
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
  err: { fontSize: 14.5, textAlign: 'center', padding: 8 },
});
