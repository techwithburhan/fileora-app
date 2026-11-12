import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import PressableScale from '../components/PressableScale';
import { getPosts, Post } from '../api/wp';
import { brand, Theme } from '../theme';

export default function BlogScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [end, setEnd] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (p: number, replace: boolean) => {
    setError(false);
    try {
      const next = await getPosts(p, 10);
      setPosts(old => (replace ? next : [...old, ...next.filter(n => !old.some(o => o.id === n.id))]));
      setPage(p);
      setEnd(next.length < 10);
    } catch (e) {
      // WordPress answers 400 past the last page
      if (String(e).includes('400')) setEnd(true);
      else setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(1, true);
  }, [load]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title="Blog" theme={theme} onBack={() => nav.goBack()} />
      <Animated.FlatList
        data={posts}
        keyExtractor={p => String(p.id)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[brand.green]}
            onRefresh={() => {
              setRefreshing(true);
              load(1, true);
            }}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && !end && !error && posts.length) {
            setLoading(true);
            load(page + 1, false);
          }
        }}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator color={brand.green} style={styles.footer} />
          ) : error ? (
            <Text style={[styles.err, { color: theme.muted }]} onPress={() => load(posts.length ? page + 1 : 1, !posts.length)}>
              Posts couldn’t load. <Text style={{ color: theme.link }}>Try again</Text>
            </Text>
          ) : undefined
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay((index % 10) * 50).duration(400)}>
            <PressableScale
              scaleTo={0.98}
              onPress={() => nav.navigate('Web', { url: item.link, title: 'Blog' })}
              accessibilityRole="link"
              accessibilityLabel={item.title}
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={[styles.img, { backgroundColor: theme.surface2 }]} resizeMode="cover" />
              ) : null}
              <View style={styles.body}>
                <Text style={[styles.date, { color: theme.muted }]}>
                  {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                <Text style={[styles.postTitle, { color: theme.ink }]}>{item.title}</Text>
                {item.excerpt ? (
                  <Text style={[styles.excerpt, { color: theme.ink2 }]} numberOfLines={3}>
                    {item.excerpt}
                  </Text>
                ) : null}
              </View>
            </PressableScale>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  card: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  img: { width: '100%', aspectRatio: 16 / 9 },
  body: { padding: 14, gap: 6 },
  date: { fontSize: 12.5, fontWeight: '700' },
  postTitle: { fontSize: 17, lineHeight: 23, fontWeight: '800' },
  excerpt: { fontSize: 14, lineHeight: 20 },
  footer: { marginVertical: 20 },
  err: { textAlign: 'center', fontSize: 14.5, padding: 16 },
});
