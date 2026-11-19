/** A small slider (tap or drag on the track); screen readers can step it up and down. */
import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Text from '../../i18n/Text';
import { Theme } from '../../theme';

type Props = { value: number; min: number; max: number; step?: number; suffix?: string; label: string; theme: Theme; onChange: (v: number) => void; onDone?: (v: number) => void; onDrag?: (active: boolean) => void };

export default function Slider({ value, min, max, step = 1, suffix = '', label, theme, onChange, onDone, onDrag }: Props) {
  const width = useRef(1);
  const [active, setActive] = useState(false);
  const last = useRef(value);
  const snap = (x: number) => {
    const f = Math.max(0, Math.min(1, x / width.current));
    const raw = min + f * (max - min);
    const v = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, +v.toFixed(4)));
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => {
        setActive(true);
        onDrag?.(true);
        last.current = snap(e.nativeEvent.locationX);
        onChange(last.current);
      },
      onPanResponderMove: e => {
        const v = snap(e.nativeEvent.locationX);
        if (v !== last.current) {
          last.current = v;
          onChange(v);
        }
      },
      onPanResponderRelease: () => {
        setActive(false);
        onDrag?.(false);
        onDone?.(last.current);
      },
      onPanResponderTerminate: () => {
        setActive(false);
        onDrag?.(false);
        onDone?.(last.current);
      },
    }),
  ).current;
  const f = max > min ? (value - min) / (max - min) : 0;
  const stepBy = (d: number) => {
    const v = Math.max(min, Math.min(max, +(value + d * step).toFixed(4)));
    onChange(v);
    onDone?.(v);
  };
  return (
    <View style={styles.row}>
      <View
        style={styles.touch}
        onLayout={e => (width.current = Math.max(1, e.nativeEvent.layout.width))}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: `${value}${suffix}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => stepBy(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        {...pan.panHandlers}>
        <View pointerEvents="none" style={[styles.track, { backgroundColor: theme.line }]}>
          <View style={[styles.fill, { width: `${f * 100}%`, backgroundColor: theme.accent }]} />
        </View>
        <View pointerEvents="none" style={[styles.knob, { left: `${f * 100}%`, backgroundColor: theme.surface, borderColor: theme.accent }, active && styles.knobOn]} />
      </View>
      <Text style={[styles.out, { color: theme.ink }]}>
        {value}
        {suffix}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  touch: { flex: 1, height: 40, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6 },
  knob: { position: 'absolute', width: 24, height: 24, marginLeft: -12, borderRadius: 12, borderWidth: 3, top: 8 },
  knobOn: { transform: [{ scale: 1.15 }] },
  out: { minWidth: 54, textAlign: 'right', fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
