/**
 * Home charts, drawn from the usage history kept on this phone:
 *  - UsageDonut: tool uses by category (fixed category colours, legend with numbers, tap to focus)
 *  - WeekBars: data processed per day over the last 7 days (tap a bar for its value)
 */
import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import type { CategoryId } from '../data/tools';
import { formatBytes } from '../store/files';
import { chartColor, Theme } from '../theme';
import { type } from '../typography';

const polar = (cx: number, cy: number, r: number, a: number) => ({ x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) });

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  return `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

export function UsageDonut({ data, theme }: { data: { cat: CategoryId; name: string; count: number }[]; theme: Theme }) {
  const [sel, setSel] = useState<CategoryId | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);
  const size = 132;
  const thick = 20;
  const r = (size - thick) / 2;
  const c = size / 2;
  const gap = data.length > 1 ? 2 / r : 0; // 2 px gap in the card colour between segments
  let a = 0;
  const focused = data.find(d => d.cat === sel);
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;

  return (
    <View style={styles.donutRow}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Tool uses by category: ${data.map(d => `${d.name} ${d.count}`).join(', ')}`}>
        <Svg width={size} height={size}>
          {data.length === 1 ? (
            <Circle cx={c} cy={c} r={r} stroke={chartColor(data[0].cat, theme)} strokeWidth={thick} fill="none" />
          ) : (
            data.map(d => {
              const span = (d.count / total) * Math.PI * 2;
              const path = arc(c, c, r, a + gap / 2, a + span - gap / 2);
              a += span;
              return (
                <Path
                  key={d.cat}
                  d={path}
                  stroke={chartColor(d.cat, theme)}
                  strokeWidth={sel === d.cat ? thick + 4 : thick}
                  opacity={sel && sel !== d.cat ? 0.35 : 1}
                  fill="none"
                  onPress={() => setSel(s => (s === d.cat ? null : d.cat))}
                />
              );
            })
          )}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <Text style={[type.title, { color: theme.ink }]}>{focused ? focused.count : total}</Text>
          <Text style={[type.caption, styles.centerText, { color: theme.muted }]} numberOfLines={2}>
            {focused ? focused.name : total === 1 ? 'use' : 'uses'}
          </Text>
        </View>
      </View>
      <View style={styles.legend}>
        {data.map(d => (
          <Pressable
            key={d.cat}
            onPress={() => setSel(s => (s === d.cat ? null : d.cat))}
            accessibilityRole="button"
            accessibilityState={{ selected: sel === d.cat }}
            accessibilityLabel={`${d.name}: ${d.count} uses, ${pct(d.count)}`}
            style={[styles.legendRow, sel && sel !== d.cat && styles.dim]}>
            <View style={[styles.swatch, { backgroundColor: chartColor(d.cat, theme) }]} />
            <Text style={[type.caption, styles.flex, { color: theme.ink2 }]} numberOfLines={1}>
              {d.name}
            </Text>
            <Text style={[type.caption, { color: theme.ink }]}>{d.count}</Text>
            <Text style={[type.caption, styles.pct, { color: theme.muted }]}>{pct(d.count)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function WeekBars({ data, theme }: { data: { label: string; date: string; bytes: number }[]; theme: Theme }) {
  const [w, setW] = useState(0);
  const [sel, setSel] = useState(data.length - 1);
  const h = 128;
  const top = 22; // room for the value label
  const bottom = 20; // day labels
  const plotH = h - top - bottom;
  const max = Math.max(...data.map(d => d.bytes), 1);
  const col = w / data.length;
  const barW = Math.min(26, col * 0.55);
  const color = theme.dark ? '#1E9E5F' : '#129A57';
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const s = data[sel];

  const bar = (x: number, y: number, bw: number, bh: number) => {
    const rr = Math.min(4, bw / 2, bh);
    return `M${x} ${y + bh}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + bw - rr}Q${x + bw} ${y} ${x + bw} ${y + rr}V${y + bh}Z`;
  };

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Data processed per day: ${data.map(d => `${d.label} ${formatBytes(d.bytes)}`).join(', ')}`}>
      {w > 0 && (
        <Svg width={w} height={h}>
          <Line x1={0} x2={w} y1={top + plotH} y2={top + plotH} stroke={theme.line} strokeWidth={1} />
          {data.map((d, i) => {
            const bh = d.bytes ? Math.max(3, (d.bytes / max) * plotH) : 0;
            const x = i * col + (col - barW) / 2;
            return (
              <G key={d.date}>
                {bh > 0 && <Path d={bar(x, top + plotH - bh, barW, bh)} fill={color} opacity={i === sel ? 1 : 0.55} />}
                <Rect x={i * col} y={0} width={col} height={h} fill="transparent" onPress={() => setSel(i)} />
              </G>
            );
          })}
        </Svg>
      )}
      {w > 0 && (
        <>
          <View style={[styles.days, { top: h - bottom + 3 }]} pointerEvents="none">
            {data.map((d, i) => (
              <Text key={d.date} style={[type.caption, styles.day, { width: col, color: i === sel ? theme.ink : theme.muted }]}>
                {d.label}
              </Text>
            ))}
          </View>
          {s && s.bytes > 0 && (
            <Text
              pointerEvents="none"
              style={[
                type.caption,
                styles.value,
                { color: theme.ink, left: Math.max(0, Math.min(w - 90, sel * col + col / 2 - 45)), top: Math.max(0, top + plotH - (s.bytes / max) * plotH - 18) },
              ]}>
              {formatBytes(s.bytes)}
            </Text>
          )}
        </>
      )}
      <Text style={[type.caption, styles.summary, { color: theme.muted }]}>
        {s ? `${s.date}: ${s.bytes ? formatBytes(s.bytes) : 'nothing'} processed` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  centerText: { textAlign: 'center' },
  legend: { flex: 1, gap: 2 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
  dim: { opacity: 0.45 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  pct: { width: 36, textAlign: 'right' },
  days: { position: 'absolute', left: 0, flexDirection: 'row' },
  day: { textAlign: 'center' },
  value: { position: 'absolute', width: 90, textAlign: 'center' },
  summary: { marginTop: 4 },
});
