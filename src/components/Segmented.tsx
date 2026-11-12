import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import PressableScale from './PressableScale';
import { Theme } from '../theme';
import { type } from '../typography';

export default function Segmented<T extends string>({
  items,
  value,
  onChange,
  theme,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  theme: Theme;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {items.map(it => {
        const on = it.id === value;
        return (
          <PressableScale
            key={it.id}
            onPress={() => onChange(it.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.item, { backgroundColor: on ? theme.accent : theme.surface, borderColor: on ? theme.accent : theme.line }]}>
            <Text style={[type.caption, styles.text, { color: on ? theme.onAccent : theme.ink2 }]}>
              {it.label}
              {it.count !== undefined ? ` · ${it.count}` : ''}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 8 },
  item: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' },
  text: { fontSize: 13.5, fontWeight: '700' },
});
