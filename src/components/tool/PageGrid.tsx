/** Pages of a PDF as a grid (Organize and other page tools): move, turn and delete pages. */
import { useCells } from '../../lib/useCells';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Icon from '../Icon';
import PressableScale from '../PressableScale';
import type { PageRef } from '../../engine/engine';
import { Theme } from '../../theme';
import { type } from '../../typography';

type Props = { pages: PageRef[]; total: number; thumbs: Record<string, string>; theme: Theme; onChange: (p: PageRef[]) => void; onReset: () => void };

export default function PageGrid({ pages, total, thumbs, theme, onChange, onReset }: Props) {
  const grid = useCells(3, 10); // three pages per row, measured (see lib/useCells)
  const move = (k: number, d: number) => {
    const j = k + d;
    if (j < 0 || j >= pages.length) return;
    const n = [...pages];
    [n[k], n[j]] = [n[j], n[k]];
    onChange(n);
  };
  const turn = (k: number) => onChange(pages.map((p, i) => (i === k ? { ...p, rot: (p.rot + 90) % 360 } : p)));
  const del = (k: number) => onChange(pages.filter((_, i) => i !== k));
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[type.heading, styles.flex, { color: theme.ink }]}>
          {pages.length} of {total} pages kept
        </Text>
        <PressableScale onPress={onReset} hitSlop={8} accessibilityRole="button" style={[styles.reset, { borderColor: theme.line }]}>
          <Icon name="refresh" size={14} color={theme.ink2} />
          <Text style={[type.caption, styles.bold, { color: theme.ink2 }]}>Reset pages</Text>
        </PressableScale>
      </View>
      <View style={styles.grid} onLayout={grid.onLayout}>
        {pages.map((p, k) => {
          const uri = thumbs[p.key];
          return (
            <View key={p.key} style={[styles.card, { width: grid.width, backgroundColor: theme.surface, borderColor: theme.line }]}>
              <View style={[styles.thumb, { backgroundColor: theme.surface2 }]}>
                {uri ? (
                  <Image source={{ uri }} style={[styles.img, { transform: [{ rotate: `${p.rot}deg` }, { scale: p.rot % 180 ? 0.72 : 1 }] }]} resizeMode="contain" accessibilityIgnoresInvertColors />
                ) : (
                  <Icon name="file" size={22} color={theme.muted} />
                )}
                <View style={[styles.num, { backgroundColor: theme.ink }]}>
                  <Text style={[styles.numText, { color: theme.bg }]}>{k + 1}</Text>
                </View>
              </View>
              <Text style={[type.caption, styles.center, { color: theme.ink2 }]} numberOfLines={1}>
                Page {p.i + 1}
                {p.rot ? `, ${p.rot}°` : ''}
              </Text>
              <View style={styles.acts}>
                <PressableScale onPress={() => move(k, -1)} disabled={k === 0} hitSlop={4} accessibilityLabel={`Move page ${p.i + 1} earlier`} style={styles.act}>
                  <Icon name="back" size={16} color={k === 0 ? theme.line : theme.ink2} />
                </PressableScale>
                <PressableScale onPress={() => turn(k)} hitSlop={4} accessibilityLabel={`Turn page ${p.i + 1}`} style={styles.act}>
                  <Icon name="rotate" size={16} color={theme.ink2} />
                </PressableScale>
                <PressableScale onPress={() => del(k)} disabled={pages.length <= 1} hitSlop={4} accessibilityLabel={`Delete page ${p.i + 1}`} style={styles.act}>
                  <Icon name="trash" size={16} color={pages.length <= 1 ? theme.line : theme.danger} />
                </PressableScale>
                <PressableScale onPress={() => move(k, 1)} disabled={k === pages.length - 1} hitSlop={4} accessibilityLabel={`Move page ${p.i + 1} later`} style={styles.act}>
                  <Icon name="chevron" size={16} color={k === pages.length - 1 ? theme.line : theme.ink2} />
                </PressableScale>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  center: { textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reset: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, minHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 0, borderWidth: 1, borderRadius: 14, padding: 6, gap: 4 },
  thumb: { aspectRatio: 0.72, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  num: { position: 'absolute', left: 4, top: 4, minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  numText: { fontSize: 11, fontWeight: '800' },
  acts: { flexDirection: 'row', justifyContent: 'space-between' },
  act: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
