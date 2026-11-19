/**
 * One option of a tool, drawn natively from the website's own option definition:
 * seg, select, text, password, textarea, number, range, toggle, color, pos, margins, image,
 * signature, note. Help texts and "show only when…" come from the tool's code (engine state).
 */
import React, { useEffect, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import Text from '../../i18n/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../Icon';
import PressableScale from '../PressableScale';
import Slider from './Slider';
import SignatureField, { SigValue } from './SignatureField';
import { pickFiles, Picked } from '../../lib/pick';
import type { OptField, PictureValue } from '../../engine/engine';
import { Theme } from '../../theme';
import { type } from '../../typography';
import { tr } from '../../i18n/i18n';

const POS_LABEL: Record<string, string> = { tl: 'Top left', tc: 'Top centre', tr: 'Top right', ml: 'Middle left', mc: 'Centre', mr: 'Middle right', bl: 'Bottom left', bc: 'Bottom centre', br: 'Bottom right' };
const POS_ALL = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

type Props = {
  f: OptField;
  value: unknown;
  help?: string;
  theme: Theme;
  onChange: (v: unknown) => void;
  onImage: (file: Picked | null) => Promise<void>;
  onSignature: (v: SigValue) => Promise<void>;
  onScrollLock: (lock: boolean) => void;
};

const pairs = (c: OptField['choices']): [string, string][] => (c ?? []).map(x => (Array.isArray(x) ? [String(x[0]), String(x[1])] : [String(x), String(x)]));

export default function OptionField({ f, value, help, theme, onChange, onImage, onSignature, onScrollLock }: Props) {
  const label = f.label && f.type !== 'toggle' && f.type !== 'note' ? <Text style={[type.heading, { color: theme.ink }]}>{f.label}</Text> : null;
  const helpText = help ? <Text style={[type.caption, styles.help, { color: theme.muted }]}>{help}</Text> : null;
  let body: React.ReactNode = null;

  switch (f.type) {
    case 'seg':
      body = <Chips choices={pairs(f.choices)} value={String(value)} theme={theme} onChange={onChange} label={f.label ?? ''} />;
      break;
    case 'select': {
      const ch = pairs(f.choices);
      body = ch.length <= 6 ? <Chips choices={ch} value={String(value)} theme={theme} onChange={onChange} label={f.label ?? ''} /> : <Select choices={ch} value={String(value)} theme={theme} onChange={onChange} label={f.label ?? ''} />;
      break;
    }
    case 'text':
    case 'password':
      body = <TextField value={String(value ?? '')} secret={f.type === 'password'} placeholder={f.placeholder} maxLength={f.maxlength} label={f.label ?? ''} theme={theme} onChange={onChange} />;
      break;
    case 'textarea':
      body = <TextField value={String(value ?? '')} multiline placeholder={f.placeholder} label={f.label ?? ''} theme={theme} onChange={onChange} />;
      break;
    case 'number':
      body = <NumberField value={value as number} min={f.min} max={f.max} suffix={f.suffix} label={f.label ?? ''} theme={theme} onChange={onChange} />;
      break;
    case 'range':
      body = <RangeField value={Number(value)} f={f} theme={theme} onChange={onChange} onScrollLock={onScrollLock} />;
      break;
    case 'toggle':
      body = (
        <View style={[styles.toggle, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[type.body, styles.flex, { color: theme.ink }]}>{f.label}</Text>
          <Switch value={!!value} onValueChange={onChange} trackColor={{ true: theme.accent, false: theme.line }} thumbColor="#fff" accessibilityLabel={f.label} />
        </View>
      );
      break;
    case 'color':
      body = <ColorField choices={(f.choices ?? []).map(String)} custom={!!f.custom} value={String(value ?? '')} theme={theme} onChange={onChange} label={f.label ?? ''} />;
      break;
    case 'pos':
      body = <PosGrid cells={f.cells ?? POS_ALL} value={String(value)} theme={theme} onChange={onChange} />;
      break;
    case 'margins':
      body = <Margins value={(value as Record<string, number>) ?? { top: 0, right: 0, bottom: 0, left: 0 }} theme={theme} onChange={onChange} />;
      break;
    case 'image':
      body = <ImageField value={value as PictureValue} theme={theme} onPick={onImage} />;
      break;
    case 'signature':
      body = <SignatureField value={value as PictureValue} theme={theme} onChange={onSignature} onScrollLock={onScrollLock} />;
      break;
    case 'note':
      body = (
        <View style={[styles.note, { backgroundColor: theme.surface2 }]}>
          <Icon name="info" size={18} color={theme.ink2} />
          <Text style={[type.bodySm, styles.flex, { color: theme.ink2 }]}>{f.text}</Text>
        </View>
      );
      break;
  }
  return (
    <View style={styles.field}>
      {label}
      {body}
      {helpText}
    </View>
  );
}

function Chips({ choices, value, theme, onChange, label }: { choices: [string, string][]; value: string; theme: Theme; onChange: (v: string) => void; label: string }) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {choices.map(([v, l]) => {
        const on = value === v;
        return (
          <PressableScale
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[styles.chip, { backgroundColor: on ? theme.accent : theme.surface, borderColor: on ? theme.accent : theme.line }]}>
            <Text style={[type.caption, styles.chipText, { color: on ? theme.onAccent : theme.ink2 }]}>{l}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function Select({ choices, value, theme, onChange, label }: { choices: [string, string][]; value: string; theme: Theme; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const cur = choices.find(c => c[0] === value)?.[1] ?? value;
  return (
    <>
      <PressableScale onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${cur}`} style={[styles.select, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <Text style={[type.body, styles.flex, { color: theme.ink }]}>{cur}</Text>
        <Icon name="down" size={18} color={theme.ink2} />
      </PressableScale>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel={tr('Close')}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 12 }]}>
            <Text style={[type.section, styles.sheetTitle, { color: theme.ink }]}>{label}</Text>
            <FlatList
              data={choices}
              keyExtractor={c => c[0]}
              renderItem={({ item: [v, l] }) => (
                <Pressable
                  onPress={() => {
                    onChange(v);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: v === value }}
                  style={[styles.option, { borderColor: theme.line }]}>
                  <Text style={[type.body, styles.flex, { color: theme.ink }, v === value && styles.bold]}>{l}</Text>
                  {v === value && <Icon name="check" size={20} color={theme.accent} />}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/* text fields keep their own value while typing; the tool hears every change */
function TextField({ value, secret, multiline, placeholder, maxLength, label, theme, onChange }: { value: string; secret?: boolean; multiline?: boolean; placeholder?: string; maxLength?: number; label: string; theme: Theme; onChange: (v: string) => void }) {
  const [v, setV] = useState(value);
  const [shown, setShown] = useState(false);
  useEffect(() => setV(value), [value]);
  return (
    <View>
      <TextInput
        value={v}
        onChangeText={t => {
          setV(t);
          onChange(t);
        }}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        secureTextEntry={secret && !shown}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.area, secret && styles.inputPw, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.line }]}
        accessibilityLabel={label}
      />
      {secret && (
        <PressableScale onPress={() => setShown(s => !s)} hitSlop={8} style={styles.eye} accessibilityRole="button" accessibilityLabel={shown ? 'Hide password' : 'Show password'}>
          <Text style={[type.caption, styles.bold, { color: theme.link }]}>{shown ? 'Hide' : 'Show'}</Text>
        </PressableScale>
      )}
    </View>
  );
}

function NumberField({ value, min, max, suffix, label, theme, onChange }: { value: number; min?: number; max?: number; suffix?: string; label: string; theme: Theme; onChange: (v: number) => void }) {
  const [v, setV] = useState(String(value ?? ''));
  useEffect(() => setV(String(value ?? '')), [value]);
  return (
    <View style={styles.numRow}>
      <TextInput
        value={v}
        onChangeText={t => {
          setV(t);
          const n = parseFloat(t.replace(',', '.'));
          if (!isNaN(n)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
        }}
        keyboardType="decimal-pad"
        style={[styles.input, styles.flex, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.line }]}
        accessibilityLabel={label}
      />
      {suffix ? <Text style={[type.body, { color: theme.muted }]}>{suffix}</Text> : null}
    </View>
  );
}

function RangeField({ value, f, theme, onChange, onScrollLock }: { value: number; f: OptField; theme: Theme; onChange: (v: number) => void; onScrollLock: (l: boolean) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <Slider value={v} min={f.min ?? 0} max={f.max ?? 100} step={f.step ?? 1} suffix={f.suffix} label={f.label ?? ''} theme={theme} onChange={setV} onDone={onChange} onDrag={onScrollLock} />;
}

function ColorField({ choices, custom, value, theme, onChange, label }: { choices: string[]; custom: boolean; value: string; theme: Theme; onChange: (v: string) => void; label: string }) {
  const own = !choices.includes(value);
  const [hex, setHex] = useState(own ? value : '');
  return (
    <View style={styles.colors} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {choices.map(c => (
        <PressableScale
          key={c}
          onPress={() => onChange(c)}
          accessibilityRole="radio"
          accessibilityState={{ checked: c === value }}
          accessibilityLabel={`Colour ${c}`}
          style={[styles.swatch, { backgroundColor: c, borderColor: c === value ? theme.accent : theme.line }]}>
          {c === value && <Icon name="check" size={16} color={/^#(f|e|d)/i.test(c) ? '#16182F' : '#fff'} width={3} />}
        </PressableScale>
      ))}
      {custom && (
        <View style={[styles.hexBox, { borderColor: own ? theme.accent : theme.line, backgroundColor: theme.surface }]}>
          <View style={[styles.hexDot, { backgroundColor: /^#[0-9a-f]{6}$/i.test(hex) ? hex : theme.surface2 }]} />
          <TextInput
            value={hex}
            onChangeText={t => {
              const x = t.startsWith('#') ? t : `#${t}`;
              setHex(x);
              if (/^#[0-9a-f]{6}$/i.test(x)) onChange(x.toLowerCase());
            }}
            placeholder={tr('#2337b8')}
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            style={[styles.hexInput, { color: theme.ink }]}
            accessibilityLabel={tr('Any colour, as a hex code')}
          />
        </View>
      )}
    </View>
  );
}

function PosGrid({ cells, value, theme, onChange }: { cells: string[]; value: string; theme: Theme; onChange: (v: string) => void }) {
  return (
    <View style={[styles.pos, { width: 3 * 44 + 10, borderColor: theme.line, backgroundColor: theme.surface }]} accessibilityRole="radiogroup">
      {POS_ALL.map(c => {
        if (!cells.includes(c)) return cells.length === 9 ? null : <View key={c} style={styles.posCell} />;
        const on = value === c;
        return (
          <Pressable key={c} onPress={() => onChange(c)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={POS_LABEL[c]} style={styles.posCell}>
            <View style={[styles.posDot, { backgroundColor: on ? theme.accent : theme.line }, on && styles.posDotOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function Margins({ value, theme, onChange }: { value: Record<string, number>; theme: Theme; onChange: (v: Record<string, number>) => void }) {
  return (
    <View style={styles.margins}>
      {['top', 'right', 'bottom', 'left'].map(s => (
        <View key={s} style={styles.marginCell}>
          <Text style={[type.caption, { color: theme.muted }]}>{s[0].toUpperCase() + s.slice(1)}</Text>
          <NumberField value={value[s] ?? 0} min={0} max={300} label={`${s} margin`} theme={theme} onChange={n => onChange({ ...value, [s]: Math.max(0, n) })} />
        </View>
      ))}
    </View>
  );
}

function ImageField({ value, theme, onPick }: { value: PictureValue; theme: Theme; onPick: (f: Picked | null) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const choose = async () => {
    const [f] = await pickFiles('image', false);
    if (!f) return;
    setBusy(true);
    try {
      await onPick(f);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={[styles.imgPick, { borderColor: theme.line, backgroundColor: theme.surface }]}>
      <View style={[styles.imgPrev, { backgroundColor: theme.surface2 }]}>
        {value?.preview ? <Image source={{ uri: value.preview }} style={styles.imgPrevImg} resizeMode="contain" accessibilityLabel={tr('Chosen picture')} /> : <Icon name="image" size={26} color={theme.muted} />}
      </View>
      <View style={styles.flex}>
        <PressableScale onPress={choose} disabled={busy} accessibilityRole="button" style={[styles.smallBtn, { borderColor: theme.line }]}>
          <Text style={[type.button, { color: theme.ink }]}>{busy ? 'Opening…' : value ? 'Change picture' : 'Choose a picture'}</Text>
        </PressableScale>
        <Text style={[type.caption, { color: theme.muted }]} numberOfLines={2}>
          {value ? value.name : 'PNG or JPG. Transparent PNG works best for logos and stamps.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  help: { marginTop: -2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  chipText: { fontSize: 13.5 },
  select: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50 },
  scrim: { flex: 1, backgroundColor: 'rgba(2,11,23,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingTop: 16 },
  sheetTitle: { paddingHorizontal: 20, paddingBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50, fontSize: 16 },
  inputPw: { paddingRight: 64 },
  area: { minHeight: 110, paddingTop: 12 },
  eye: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 54 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  hexBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingLeft: 6, paddingRight: 12, height: 40 },
  hexDot: { width: 28, height: 28, borderRadius: 14 },
  hexInput: { fontSize: 15, minWidth: 80, paddingVertical: 0 },
  pos: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderRadius: 14, padding: 4 },
  posCell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  posDot: { width: 14, height: 14, borderRadius: 7 },
  posDotOn: { width: 20, height: 20, borderRadius: 10 },
  margins: { flexDirection: 'row', gap: 8 },
  marginCell: { flex: 1, gap: 4 },
  note: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 12, alignItems: 'flex-start' },
  imgPick: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10, alignItems: 'center' },
  imgPrev: { width: 72, height: 72, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imgPrevImg: { width: 72, height: 72 },
  smallBtn: { borderWidth: 1, borderRadius: 12, minHeight: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
});
