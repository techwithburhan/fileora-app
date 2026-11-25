import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Text from '../i18n/Text';
import PressableScale from './PressableScale';
import { Theme } from '../theme';
import { type } from '../typography';

export default function Segmented<T extends string>({
  items,
  value,
  onChange,
  theme,
  wrap = false,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  theme: Theme;
  /** 1.2.4: lay the items out as a grid that wraps (every item visible) instead of one scrolling row */
  wrap?: boolean;
}) {
  const list = items.map(it => {
        const on = it.id === value;
        return (
          <PressableScale
            key={it.id}
            onPress={() => onChange(it.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.item, wrap && styles.cell, { backgroundColor: on ? theme.accent : theme.surface, borderColor: on ? theme.accent : theme.line }]}>
            <Text style={[type.caption, styles.text, { color: on ? theme.onAccent : theme.ink2 }]} numberOfLines={wrap ? 1 : undefined}>
              {it.label}
              {it.count !== undefined ? ` · ${it.count}` : ''}
            </Text>
          </PressableScale>
        );
      });
  if (wrap)
    return (
      <View style={styles.grid} accessibilityRole="tablist">
        {list}
      </View>
    );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {list}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 8 },
  item: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' },
  text: { fontSize: 13.5, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexGrow: 1, flexBasis: '30%', alignItems: 'center' },
});
