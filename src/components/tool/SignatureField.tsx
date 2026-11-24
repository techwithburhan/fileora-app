/**
 * Signature like the website: draw it, type it (handwriting font) or use a photo of it. The
 * engine turns it into the same transparent PNG the website makes.
 */
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, StyleSheet, TextInput, View } from 'react-native';
import Text from '../../i18n/Text';
import Svg, { Path } from 'react-native-svg';
import PressableScale from '../PressableScale';
import Segmented from '../Segmented';
import { pickFiles, Picked } from '../../lib/pick';
import type { PictureValue } from '../../engine/engine';
import { Theme } from '../../theme';
import { type } from '../../typography';
import { tr } from '../../i18n/i18n';

const INKS = [
  { v: '#16182F', label: 'Black ink' },
  { v: '#2337B8', label: 'Blue ink' },
];
type Mode = 'draw' | 'type' | 'upload';
export type SigValue = { mode: 'draw'; strokes: number[][][]; ink: string } | { mode: 'type'; text: string; ink: string } | { mode: 'upload'; file: Picked } | null;

function pathOf(s: number[][]): string {
  if (!s.length) return '';
  let d = `M${s[0][0]} ${s[0][1]}`;
  if (s.length === 1) return d + ` L${s[0][0] + 0.1} ${s[0][1]}`;
  for (let i = 1; i < s.length; i++) {
    const q = s[i - 1];
    const p = s[i];
    d += ` Q${q[0]} ${q[1]} ${(p[0] + q[0]) / 2} ${(p[1] + q[1]) / 2}`;
  }
  return d;
}

export default function SignatureField({ value, theme, onChange, onScrollLock }: { value: PictureValue; theme: Theme; onChange: (v: SigValue) => Promise<void>; onScrollLock: (lock: boolean) => void }) {
  const [mode, setMode] = useState<Mode>('draw');
  const [ink, setInk] = useState(INKS[0].v);
  const [strokes, setStrokes] = useState<number[][][]>([]);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = useRef<number[][] | null>(null);
  const all = useRef<number[][][]>([]);
  const inkRef = useRef(ink);
  inkRef.current = ink;
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = async (v: SigValue) => {
    setBusy(true);
    try {
      await onChange(v);
    } finally {
      setBusy(false);
    }
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => {
        onScrollLock(true);
        cur.current = [[e.nativeEvent.locationX, e.nativeEvent.locationY]];
        all.current = [...all.current, cur.current];
        setStrokes(all.current);
      },
      onPanResponderMove: e => {
        const c = cur.current;
        if (!c) return;
        const p = [e.nativeEvent.locationX, e.nativeEvent.locationY];
        const q = c[c.length - 1];
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.2) {
          c.push(p);
          setStrokes([...all.current]);
        }
      },
      onPanResponderRelease: () => {
        cur.current = null;
        onScrollLock(false);
        send({ mode: 'draw', strokes: all.current.map(s => s.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10])), ink: inkRef.current });
      },
      onPanResponderTerminate: () => {
        cur.current = null;
        onScrollLock(false);
      },
    }),
  ).current;

  const switchTo = (m: Mode) => {
    setMode(m);
    if (m === 'draw') send(all.current.length ? { mode: 'draw', strokes: all.current, ink } : null);
    else if (m === 'type') send(text.trim() ? { mode: 'type', text, ink } : null);
    else send(photo ? { mode: 'upload', file: photo } : null);
  };
  const pickInk = (v: string) => {
    setInk(v);
    if (mode === 'draw' && all.current.length) send({ mode: 'draw', strokes: all.current, ink: v });
    if (mode === 'type' && text.trim()) send({ mode: 'type', text, ink: v });
  };
  const clear = () => {
    all.current = [];
    setStrokes([]);
    setText('');
    setPhoto(null);
    send(null);
  };
  const choosePhoto = async () => {
    const [f] = await pickFiles('image', false);
    if (!f) return;
    setPhoto(f);
    send({ mode: 'upload', file: f });
  };

  return (
    <View style={styles.wrap}>
      <Segmented
        theme={theme}
        value={mode}
        onChange={switchTo}
        items={[
          { id: 'draw' as Mode, label: 'Draw' },
          { id: 'type' as Mode, label: 'Type' },
          { id: 'upload' as Mode, label: 'Upload' },
        ]}
      />
      {mode === 'draw' && (
        <View style={[styles.pad, { borderColor: theme.line }]} {...pan.panHandlers} accessibilityLabel={tr('Signature pad. Draw your signature with your finger.')}>
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            {strokes.map((s, i) => (
              <Path key={i} d={pathOf(s)} stroke={ink} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            ))}
          </Svg>
          <View pointerEvents="none" style={styles.line} />
          {!strokes.length && (
            <Text pointerEvents="none" style={styles.ph}>
              Sign above the line
            </Text>
          )}
        </View>
      )}
      {mode === 'type' && (
        <TextInput
          value={text}
          onChangeText={t => {
            setText(t);
            if (typing.current) clearTimeout(typing.current);
            typing.current = setTimeout(() => send(t.trim() ? { mode: 'type', text: t, ink: inkRef.current } : null), 350);
          }}
          placeholder={tr('Type your name')}
          placeholderTextColor={theme.muted}
          maxLength={40}
          style={[styles.input, { color: ink, backgroundColor: theme.surface, borderColor: theme.line }]}
          accessibilityLabel={tr('Type your name')}
        />
      )}
      {mode === 'upload' && (
        <View style={styles.upload}>
          <PressableScale onPress={choosePhoto} accessibilityRole="button" style={[styles.btn, { borderColor: theme.line, backgroundColor: theme.surface }]}>
            <Text style={[type.button, { color: theme.ink }]}>{photo ? 'Choose another picture' : 'Choose a picture of your signature'}</Text>
          </PressableScale>
          <Text style={[type.caption, { color: theme.muted }]}>{photo ? photo.name : 'A photo or scan on white paper works. The white background is removed.'}</Text>
        </View>
      )}
      <View style={styles.row}>
        {mode !== 'upload' &&
          INKS.map(i => (
            <PressableScale
              key={i.v}
              onPress={() => pickInk(i.v)}
              accessibilityRole="radio"
              accessibilityState={{ checked: ink === i.v }}
              accessibilityLabel={i.label}
              style={[styles.swatch, { backgroundColor: i.v, borderColor: ink === i.v ? theme.accent : theme.line }]}
            />
          ))}
        <View style={styles.flex} />
        {busy && <ActivityIndicator size="small" color={theme.accent} />}
        <PressableScale onPress={clear} accessibilityRole="button" hitSlop={8}>
          <Text style={[type.button, { color: theme.link }]}>Clear</Text>
        </PressableScale>
      </View>
      {value?.preview ? (
        <View style={[styles.preview, { borderColor: theme.line }]}>
          <Text style={[type.caption, { color: theme.muted }]}>Goes on the page like this</Text>
          <Image source={{ uri: value.preview }} style={[styles.previewImg, { aspectRatio: value.w / Math.max(1, value.h) }]} resizeMode="contain" accessibilityLabel={tr('Your signature')} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  flex: { flex: 1 },
  pad: { height: 170, borderWidth: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff' },
  line: { position: 'absolute', left: 24, right: 24, bottom: 44, height: 1.5, backgroundColor: '#C9D3E0' },
  ph: { position: 'absolute', bottom: 18, alignSelf: 'center', color: '#8394AE', fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 56, fontSize: 26, fontStyle: 'italic' },
  upload: { gap: 6 },
  btn: { borderWidth: 1, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  preview: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 6, backgroundColor: '#fff' },
  previewImg: { width: '70%', maxHeight: 90, alignSelf: 'center' },
});
