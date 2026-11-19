/**
 * Boxes on a picture (ID card sides, passport photo, areas to blur), like the website's region
 * editor: drag a box to move it, drag its corner to resize it (the photo size keeps its shape).
 * Coordinates are fractions (0..1) of the picture.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, View } from 'react-native';
import Text from '../../i18n/Text';
import Icon from '../Icon';
import PressableScale from '../PressableScale';
import type { Region } from '../../engine/engine';
import { Theme } from '../../theme';
import { type } from '../../typography';
import { tr } from '../../i18n/i18n';

type Props = { src: string; w: number; h: number; rects: Region[]; multi: boolean; note?: string; theme: Theme; onChange: (r: Region[]) => void; onScrollLock: (lock: boolean) => void };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function RegionEditor({ src, w, h, rects, multi, note, theme, onChange, onScrollLock }: Props) {
  const [size, setSize] = useState({ W: 1, H: 1 });
  const [list, setList] = useState<Region[]>(rects);
  const [active, setActive] = useState<string | null>(rects[0]?.id ?? null);
  const ar = w / Math.max(1, h);
  const live = useRef(list);
  live.current = list;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  useEffect(() => {
    setList(rects);
    live.current = rects;
  }, [rects]);

  const norm = (r: Region): Region => {
    const x = { ...r };
    x.w = clamp(x.w, 0.02, 1);
    x.h = clamp(x.h, 0.02, 1);
    x.x = clamp(x.x, 0, 1 - x.w);
    x.y = clamp(x.y, 0, 1 - x.h);
    return x;
  };
  const fitRatio = (r: Region, keep: 'w' | 'h' = 'w'): Region => {
    if (!r.ratio) return r;
    const x = { ...r };
    const k = r.ratio / ar; // normalized w/h for the picture's own shape
    if (keep === 'w') x.h = x.w / k;
    else x.w = x.h * k;
    if (x.h > 1) {
      x.h = 1;
      x.w = k;
    }
    if (x.w > 1) {
      x.w = 1;
      x.h = 1 / k;
    }
    return x;
  };
  const update = (id: string, fn: (r: Region) => Region, commit = false) => {
    const next = live.current.map(r => (r.id === id ? fn(r) : r));
    live.current = next;
    setList(next);
    if (commit) onChange(next);
  };

  const makePan = (id: string, mode: 'move' | 'size') => {
    let start: Region | null = null;
    return PanResponder.create({
      // no capture: a touch on the corner (a child of the box) resizes instead of moving
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        onScrollLock(true);
        setActive(id);
        start = live.current.find(r => r.id === id) ?? null;
      },
      onPanResponderMove: (_, g) => {
        if (!start) return;
        const { W, H } = sizeRef.current;
        const dx = g.dx / W;
        const dy = g.dy / H;
        const s = start;
        if (mode === 'move') update(id, r => norm({ ...r, x: s.x + dx, y: s.y + dy }));
        else update(id, r => norm(fitRatio({ ...r, w: clamp(s.w + dx, 0.04, 1 - s.x), h: clamp(s.h + dy, 0.04, 1 - s.y) }, Math.abs(dx) >= Math.abs(dy) ? 'w' : 'h')));
      },
      onPanResponderRelease: () => {
        onScrollLock(false);
        onChange(live.current);
      },
      onPanResponderTerminate: () => {
        onScrollLock(false);
        onChange(live.current);
      },
    });
  };
  const pans = useRef(new Map<string, { move: ReturnType<typeof makePan>; size: ReturnType<typeof makePan> }>());
  const pansFor = (id: string) => {
    let p = pans.current.get(id);
    if (!p) pans.current.set(id, (p = { move: makePan(id, 'move'), size: makePan(id, 'size') }));
    return p;
  };

  const add = () => {
    const id = `r${Date.now().toString(36)}`;
    const r: Region = { id, x: 0.35, y: 0.35, w: 0.3, h: 0.3 };
    const next = [...live.current, r];
    live.current = next;
    setList(next);
    setActive(id);
    onChange(next);
  };
  const remove = (id: string) => {
    const next = live.current.filter(r => r.id !== id);
    live.current = next;
    setList(next);
    onChange(next);
  };
  const nudge = (id: string, dx: number, dy: number) => update(id, r => norm({ ...r, x: r.x + dx, y: r.y + dy }), true);

  return (
    <View style={styles.wrap}>
      <View style={[styles.stage, { aspectRatio: ar, borderColor: theme.line }]} onLayout={e => setSize({ W: e.nativeEvent.layout.width, H: e.nativeEvent.layout.height })}>
        <Image source={{ uri: src }} style={StyleSheet.absoluteFill} resizeMode="stretch" accessibilityIgnoresInvertColors />
        {list.map(r => {
          const on = r.id === active;
          const p = pansFor(r.id);
          return (
            <View
              key={r.id}
              style={[styles.box, { left: r.x * size.W, top: r.y * size.H, width: r.w * size.W, height: r.h * size.H }, on ? { borderColor: theme.accent } : styles.boxIdle]}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={tr('{name}: drag to move', { name: tr(r.label ?? 'Area') })}
              accessibilityActions={[{ name: 'increment', label: 'Move right' }, { name: 'decrement', label: 'Move left' }]}
              onAccessibilityAction={e => nudge(r.id, e.nativeEvent.actionName === 'increment' ? 0.02 : -0.02, 0)}
              {...p.move.panHandlers}>
              {r.label ? (
                <View style={[styles.tag, on ? { backgroundColor: theme.accent } : styles.tagIdle]}>
                  <Text style={[styles.tagText, on ? { color: theme.onAccent } : styles.tagTextIdle]} numberOfLines={1}>
                    {r.label}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.corner, on ? { backgroundColor: theme.accent } : styles.cornerIdle]} {...p.size.panHandlers} accessibilityLabel={tr('Resize')} />
              {multi && (
                <PressableScale onPress={() => remove(r.id)} hitSlop={8} style={styles.del} accessibilityRole="button" accessibilityLabel={tr('Remove this box')}>
                  <Icon name="close" size={14} color="#fff" width={3} />
                </PressableScale>
              )}
            </View>
          );
        })}
      </View>
      <Text style={[type.caption, { color: theme.muted }]}>
        {multi ? 'Drag a box to move it, or its corner to resize it. Add as many boxes as you need.' : 'Drag the boxes to move them, and their corners to resize them.'}
      </Text>
      {note ? <Text style={[type.caption, { color: theme.ink2 }]}>{note}</Text> : null}
      {multi && (
        <PressableScale onPress={add} accessibilityRole="button" style={[styles.addBtn, { borderColor: theme.line, backgroundColor: theme.surface }]}>
          <Icon name="plus" size={18} color={theme.ink} />
          <Text style={[type.button, { color: theme.ink }]}>Add a box</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  stage: { width: '100%', borderWidth: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  box: { position: 'absolute', borderWidth: 2.5, backgroundColor: 'rgba(23,175,100,0.12)' },
  boxIdle: { borderColor: '#fff' },
  tagIdle: { backgroundColor: 'rgba(4,51,107,0.8)' },
  tagTextIdle: { color: '#fff' },
  cornerIdle: { backgroundColor: '#fff' },
  tag: { position: 'absolute', left: -2, top: -24, borderRadius: 6, paddingHorizontal: 6, height: 22, justifyContent: 'center', maxWidth: 160 },
  tagText: { fontSize: 12, fontWeight: '700' },
  corner: { position: 'absolute', right: -12, bottom: -12, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#04336B' },
  del: { position: 'absolute', right: -10, top: -10, width: 22, height: 22, borderRadius: 11, backgroundColor: '#C42B31', alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 14, borderWidth: 1 },
});
