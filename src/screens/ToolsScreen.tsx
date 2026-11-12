import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import Animated, { LinearTransition, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { ToolCard } from '../components/ToolCard';
import { CATEGORIES, CategoryId, TOOLS } from '../data/tools';
import { TabParamList } from '../navigation/types';
import { Theme } from '../theme';


export default function ToolsScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const route = useRoute<RouteProp<TabParamList, 'Tools'>>();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CategoryId | 'all'>('all');
  const input = useRef<TextInputInstance>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  useEffect(() => {
    if (route.params?.cat) setCat(route.params.cat);
  }, [route.params?.cat]);
  useEffect(() => {
    if (route.params?.focus) {
      setCat('all');
      setTimeout(() => input.current?.focus(), 250);
    }
  }, [route.params?.focus]);

  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return TOOLS.filter(t => {
      if (cat !== 'all' && t.cat !== cat) return false;
      const hay = `${t.name} ${t.desc} ${t.keys}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }, [q, cat]);

  const chips = [{ id: 'all' as const, name: 'All', count: TOOLS.length }, ...CATEGORIES];

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <AppHeader theme={theme} scrollY={scrollY} search={false} />
      <Animated.FlatList
        data={list}
        keyExtractor={t => t.id}
        numColumns={2}
        onScroll={onScroll}
        scrollEventThrottle={16}
        itemLayoutAnimation={LinearTransition.duration(220)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        columnWrapperStyle={styles.col}
        ListHeaderComponent={
          <View style={styles.head}>
            <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Icon name="search" size={20} color={theme.muted} />
              <TextInput
                ref={input}
                value={q}
                onChangeText={setQ}
                placeholder={`Search ${TOOLS.length} tools`}
                placeholderTextColor={theme.muted}
                style={[styles.input, { color: theme.ink }]}
                accessibilityLabel="Search tools"
                returnKeyType="search"
                autoCorrect={false}
              />
              {q ? (
                <PressableScale onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
                  <Icon name="close" size={18} color={theme.muted} />
                </PressableScale>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsOuter}>
              {chips.map(c => {
                const on = c.id === cat;
                return (
                  <PressableScale
                    key={c.id}
                    onPress={() => setCat(c.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, { backgroundColor: on ? theme.accent : theme.surface, borderColor: on ? theme.accent : theme.line }]}>
                    <Text style={[styles.chipText, { color: on ? theme.onAccent : theme.ink2 }]}>
                      {c.name} · {c.count}
                    </Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
            <Text style={[styles.count, { color: theme.muted }]} accessibilityLiveRegion="polite">
              {list.length} {list.length === 1 ? 'tool' : 'tools'}
            </Text>
          </View>
        }
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.muted }]}>No tool matches “{q}”. Try another word.</Text>}
        renderItem={({ item, index }) => <ToolCard tool={item} theme={theme} index={index} onPress={() => nav.navigate('Tool', { id: item.id })} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 28, gap: 12 },
  col: { gap: 12 },
  head: { gap: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, minHeight: 52 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10 },
  chipsOuter: { marginHorizontal: -16 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '700' },
  count: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 30, fontSize: 15 },
});
