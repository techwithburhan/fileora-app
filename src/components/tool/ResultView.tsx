/**
 * "Your files are ready" for tools with several results or extra output: the saved files, the
 * text (Markdown, extracted text, AI summary), the differences (Compare PDF) or the colours
 * (Colour palette). Single-file results use ResultSheet instead.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import Text from '../../i18n/Text';
import Confetti from '../Confetti';
import FileThumb from '../FileThumb';
import Icon from '../Icon';
import PressableScale from '../PressableScale';
import { ToolChip } from '../ToolCard';
import type { RunResult } from '../../engine/engine';
import { relatedFor } from '../../data/nativeTools';
import { toolById } from '../../data/tools';
import { formatBytes, SAVED_WHERE } from '../../store/files';
import { FileRec } from '../../store/store';
import { Theme } from '../../theme';
import { type } from '../../typography';
import { tr } from '../../i18n/i18n';

type Extra = NonNullable<RunResult['result']>;
type Props = {
  title: string;
  files: FileRec[];
  notes: Record<string, string>;
  extra: Extra | null;
  tool: string;
  theme: Theme;
  onOpen: (f: FileRec) => void;
  onShare: (f: FileRec) => void;
  onNext: (toolId: string, f: FileRec) => void;
  onAgain: () => void;
  onStartOver: () => void;
};

export default function ResultView({ title, files, notes, extra, tool, theme, onOpen, onShare, onNext, onAgain, onStartOver }: Props) {
  const text = extra?.md || extra?.text || '';
  const next = files.length ? relatedFor(tool, files[0].mime).slice(0, 4) : [];
  return (
    <View style={styles.wrap}>
      <Confetti play />
      <View style={[styles.ok, { backgroundColor: theme.accent }]}>
        <Icon name="check" size={30} color={theme.onAccent} width={3} />
      </View>
      <Text style={[type.title, styles.center, { color: theme.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {files.length > 0 && (
        <Text style={[type.bodySm, styles.center, { color: theme.muted }]}>
          {files.length === 1 ? 'Saved' : tr('{n} files saved', { n: files.length })} in Fileora and {SAVED_WHERE} · {formatBytes(files.reduce((s, f) => s + f.size, 0))}
        </Text>
      )}

      {text ? (
        <View style={styles.block}>
          {extra?.textNote ? <Text style={[type.bodySm, { color: theme.ink2 }]}>{extra.textNote}</Text> : null}
          <View style={[styles.textBox, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text selectable style={[styles.mono, { color: theme.ink }]}>
              {text.length > 20000 ? `${text.slice(0, 20000)}\n…` : text}
            </Text>
          </View>
          <PressableScale onPress={() => Share.share({ message: text })} accessibilityRole="button" style={[styles.btn, { borderColor: theme.line, backgroundColor: theme.surface }]}>
            <Icon name="share" size={18} color={theme.ink} />
            <Text style={[type.button, { color: theme.ink }]}>Share or copy the text</Text>
          </PressableScale>
        </View>
      ) : null}

      {extra?.diff ? <Diff extra={extra} theme={theme} /> : null}

      {extra?.palette ? (
        <View style={styles.palette}>
          {extra.palette.map(c => (
            <Pressable key={c.hex} onPress={() => Share.share({ message: c.hex })} accessibilityRole="button" accessibilityLabel={tr('{hex}, {pct}%. Share the code.', { hex: c.hex, pct: c.pct })} style={[styles.swatchCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <View style={[styles.swatch, { backgroundColor: c.hex }]} />
              <Text style={[type.heading, { color: theme.ink }]}>{c.hex}</Text>
              <Text style={[type.caption, { color: theme.muted }]}>{c.pct}%</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {files.length > 0 && (
        <View style={styles.block}>
          {files.map(f => (
            <View key={f.id} style={[styles.file, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <FileThumb path={f.path} mime={f.mime} name={f.name} theme={theme} size={46} />
              <Pressable style={styles.flex} onPress={() => onOpen(f)} accessibilityRole="button" accessibilityLabel={`Open ${f.name}`}>
                <Text style={[type.heading, { color: theme.ink }]} numberOfLines={2}>
                  {f.name}
                </Text>
                <Text style={[type.caption, { color: notes[f.id] ? theme.accentInk : theme.muted }]} numberOfLines={2}>
                  {notes[f.id] ? `${notes[f.id]} · ${formatBytes(f.size)}` : formatBytes(f.size)}
                </Text>
              </Pressable>
              <PressableScale onPress={() => onShare(f)} hitSlop={6} style={styles.icon} accessibilityRole="button" accessibilityLabel={`Share ${f.name}`}>
                <Icon name="share" size={20} color={theme.ink2} />
              </PressableScale>
            </View>
          ))}
        </View>
      )}

      {next.length > 0 && files.length === 1 && (
        <View style={styles.block}>
          <Text style={[type.heading, { color: theme.ink }]}>Keep going with this file</Text>
          <View style={styles.chips}>
            {next.map(id => {
              const t = toolById(id);
              return t ? <ToolChip key={id} tool={t} theme={theme} onPress={() => onNext(id, files[0])} /> : null;
            })}
          </View>
        </View>
      )}

      <View style={styles.row}>
        <PressableScale onPress={onAgain} accessibilityRole="button" style={[styles.btn, styles.flex, { borderColor: theme.line, backgroundColor: theme.surface }]}>
          <Icon name="refresh" size={18} color={theme.ink} />
          <Text style={[type.button, { color: theme.ink }]}>Change options</Text>
        </PressableScale>
        <PressableScale onPress={onStartOver} accessibilityRole="button" style={[styles.btn, styles.flex, { backgroundColor: theme.accent, borderColor: theme.accent }]}>
          <Icon name="plus" size={18} color={theme.onAccent} />
          <Text style={[type.button, { color: theme.onAccent }]}>New files</Text>
        </PressableScale>
      </View>
    </View>
  );
}

/* Compare PDF: changed lines with two lines around them; the rest folds away */
function Diff({ extra, theme }: { extra: Extra; theme: Theme }) {
  const rows = useMemo(() => extra.diff ?? [], [extra.diff]);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const show = useMemo(() => {
    const s = new Array(rows.length).fill(false);
    rows.forEach((x, i) => {
      if (x.k !== 'ctx') for (let k = Math.max(0, i - 2); k <= Math.min(rows.length - 1, i + 2); k++) s[k] = true;
    });
    return s;
  }, [rows]);
  if (!extra.add && !extra.del)
    return (
      <View style={[styles.diffBox, { borderColor: theme.line, backgroundColor: theme.surface }]}>
        <Text style={[type.body, { color: theme.ink }]}>The text in both files is identical.</Text>
      </View>
    );
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < rows.length) {
    if (show[i] || open[i]) {
      const x = rows[i];
      out.push(
        <View key={i} style={[styles.dl, x.k === 'add' && styles.dlAdd, x.k === 'del' && styles.dlDel]}>
          <Text style={[styles.pg, { color: theme.muted }]}>p{x.p}</Text>
          <Text style={[styles.sg, { color: x.k === 'add' ? theme.accentInk : theme.danger }]}>{x.k === 'add' ? '+' : x.k === 'del' ? '−' : ''}</Text>
          <Text style={[styles.dlText, { color: theme.ink }]}>{x.t}</Text>
        </View>,
      );
      i++;
      continue;
    }
    let j = i;
    while (j < rows.length && !show[j] && !open[j]) j++;
    const a = i;
    const b = j;
    out.push(
      <Pressable
        key={`s${i}`}
        onPress={() =>
          setOpen(o => {
            const n = { ...o };
            for (let k = a; k < b; k++) n[k] = true;
            return n;
          })
        }
        accessibilityRole="button"
        style={[styles.skip, { backgroundColor: theme.surface2 }]}>
        <Text style={[type.caption, { color: theme.link }]}>
          Show {b - a} unchanged line{b - a > 1 ? 's' : ''}
        </Text>
      </Pressable>,
    );
    i = j;
  }
  return (
    <View style={[styles.diffBox, { borderColor: theme.line, backgroundColor: theme.surface }]}>
      <View style={styles.row}>
        <Text style={[type.caption, styles.bold, { color: theme.accentInk }]}>+{extra.add} added</Text>
        <Text style={[type.caption, styles.bold, { color: theme.danger }]}>−{extra.del} removed</Text>
        <Text style={[type.caption, styles.flex, { color: theme.muted }]} numberOfLines={1}>
          Original: {extra.a}
        </Text>
      </View>
      {out}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingTop: 8 },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  center: { textAlign: 'center' },
  ok: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  block: { gap: 10 },
  textBox: { borderWidth: 1, borderRadius: 14, padding: 12, maxHeight: 360, overflow: 'hidden' },
  mono: { fontFamily: 'monospace', fontSize: 12.5, lineHeight: 18 },
  btn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatchCard: { width: '30%', borderWidth: 1, borderRadius: 14, padding: 8, gap: 2 },
  swatch: { height: 54, borderRadius: 10, marginBottom: 4 },
  diffBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 4 },
  dl: { flexDirection: 'row', gap: 6, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2 },
  dlAdd: { backgroundColor: '#17AF6422' },
  dlDel: { backgroundColor: '#C42B3122' },
  pg: { width: 26, fontSize: 11, fontFamily: 'monospace' },
  sg: { width: 10, fontSize: 12, fontWeight: '800' },
  dlText: { flex: 1, fontSize: 12.5, fontFamily: 'monospace' },
  skip: { borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
});
