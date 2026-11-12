/**
 * Native tool screen: choose files (Android picker or files already in Fileora), set options,
 * run the tool, then "Your file is ready" with related tools.
 * Merge / Watermark / Page numbers run on the phone (pdf-lib); the others on the Fileora server
 * through the website's REST API.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import FileThumb from '../components/FileThumb';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import ResultSheet from '../components/ResultSheet';
import { NATIVE, OptionDef } from '../data/nativeTools';
import { toolById } from '../data/tools';
import { mergePdfs, numberPages, watermarkPdf, PageNumberOptions, WatermarkOptions } from '../lib/pdf';
import { runServerTool, JobStatus } from '../lib/serverJob';
import { pickFiles, Picked } from '../lib/pick';
import { saveResult, stamp, suffixName } from '../lib/output';
import { openRecord } from '../lib/openFile';
import { useKeepGoing } from '../lib/keepGoing';
import { formatBytes } from '../store/files';
import { FileRec, store } from '../store/store';
import { RootStackParamList } from '../navigation/types';
import { Theme } from '../theme';
import { type } from '../typography';

const ACCEPT_NOUN = { pdf: 'PDF', image: 'image', jpgpng: 'JPG or PNG image', word: 'Word document', excel: 'Excel file', ppt: 'PowerPoint file', any: 'file' } as const;

export default function ProcessScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Process'>>();
  const tool = toolById(params.tool);
  const def = NATIVE[params.tool];
  const [files, setFiles] = useState<Picked[]>(() =>
    (params.fileIds ?? [])
      .map(id => store.get().files.find(f => f.id === id))
      .filter((f): f is FileRec => !!f)
      .map(f => ({ key: f.id, name: f.name, size: f.size, path: f.path, mime: f.mime })),
  );
  const [opts, setOpts] = useState<Record<string, string | boolean>>(() => Object.fromEntries((def?.options ?? []).map(o => [o.key, o.default])));
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<FileRec | null>(null);
  const cancel = useRef({ cancelled: false });
  const keepGoing = useKeepGoing();

  useEffect(() => {
    if (tool) store.logOpen(tool.id);
    return () => {
      // leaving the screen stops polling a server task
      cancel.current.cancelled = true;
    };
  }, [tool]);

  const missing = useMemo(() => {
    if (!def) return 'Unknown tool';
    if (files.length < def.min) return def.min === 1 ? `Choose a ${ACCEPT_NOUN[def.accept]}` : `Choose at least ${def.min} ${ACCEPT_NOUN[def.accept]}s`;
    for (const o of def.options ?? []) if (o.type === 'text' && o.required && !String(opts[o.key] ?? '').trim()) return `Enter: ${o.label}`;
    if (params.tool === 'protect' && String(opts.pw ?? '').length < 4) return 'The password needs at least 4 characters';
    return null;
  }, [def, files.length, opts, params.tool]);

  if (!tool || !def) return null;
  const multi = def.max > 1;
  const onDevice = def.kind !== 'server';

  const add = async () => {
    try {
      const picked = await pickFiles(def.accept, multi);
      if (!picked.length) return;
      setFiles(old => {
        const next = multi ? [...old, ...picked] : picked.slice(0, 1);
        if (next.length > def.max) Alert.alert('Too many files', `${tool.name} takes up to ${def.max} files at a time. The first ${def.max} are kept.`);
        return next.slice(0, def.max);
      });
    } catch (e) {
      Alert.alert('Couldn’t open the file', String(e instanceof Error ? e.message : e));
    }
  };
  const move = (i: number, d: -1 | 1) =>
    setFiles(old => {
      const n = [...old];
      const j = i + d;
      if (j < 0 || j >= n.length) return old;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const remove = (key: string) => setFiles(old => old.filter(f => f.key !== key));

  const run = async () => {
    if (missing) return;
    const bytesIn = files.reduce((s, f) => s + (f.size || 0), 0);
    const signal = { cancelled: false };
    cancel.current = signal;
    try {
      let rec: FileRec;
      if (def.kind === 'merge') {
        setBusy(`Merging ${files.length} PDFs…`);
        const r = await mergePdfs(files);
        rec = await saveResult({ name: `merged-${stamp()}.pdf`, base64: r.base64, mime: 'application/pdf', tool: tool.id, bytesIn, pages: r.pages });
      } else if (def.kind === 'watermark') {
        setBusy('Adding the watermark…');
        const o: WatermarkOptions = { text: String(opts.text).trim(), size: Number(opts.size), opacity: Number(opts.opacity), color: opts.color as WatermarkOptions['color'], diagonal: !!opts.diagonal };
        const r = await watermarkPdf(files[0], o);
        rec = await saveResult({ name: suffixName(files[0].name, '-watermarked', 'pdf'), base64: r.base64, mime: 'application/pdf', tool: tool.id, bytesIn, pages: r.pages });
      } else if (def.kind === 'pagenum') {
        setBusy('Numbering the pages…');
        const start = Math.max(0, Math.min(99999, parseInt(String(opts.start), 10) || 1));
        const o: PageNumberOptions = { position: opts.position as PageNumberOptions['position'], format: opts.format as PageNumberOptions['format'], start, size: 11, skipFirst: !!opts.skipFirst };
        const r = await numberPages(files[0], o);
        rec = await saveResult({ name: suffixName(files[0].name, '-numbered', 'pdf'), base64: r.base64, mime: 'application/pdf', tool: tool.id, bytesIn, pages: r.pages });
      } else {
        setBusy('Uploading…');
        const options: Record<string, unknown> = {};
        for (const o of def.options ?? []) options[o.key] = o.type === 'text' ? String(opts[o.key] ?? '') : opts[o.key];
        const label = (s: JobStatus) =>
          s.status === 'queued' ? (s.ahead ? `Waiting in line (${s.ahead} ahead)…` : 'Starting…') : s.status === 'running' ? 'Processing on the Fileora server…' : 'Downloading the result…';
        const r = await runServerTool(
          tool.id,
          files.map(f => ({ uri: f.path, name: f.name, mime: f.mime })),
          options,
          st => {
            if (!signal.cancelled) setBusy(label(st));
          },
          signal,
        );
        setBusy('Saving…');
        rec = await saveResult({ name: r.name, fromPath: r.path, move: true, tool: tool.id, bytesIn });
      }
      setBusy(null);
      setResult(rec);
    } catch (e) {
      setBusy(null);
      if (!signal.cancelled) Alert.alert(`${tool.name} didn’t work`, e instanceof Error ? e.message : String(e));
    }
  };

  const goNext = (toolId: string, f: FileRec) => {
    setResult(null);
    keepGoing(toolId, f);
  };

  const option = (o: OptionDef) => {
    if (o.type === 'toggle')
      return (
        <View key={o.key} style={[styles.toggle, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[type.body, styles.flex, { color: theme.ink }]}>{o.label}</Text>
          <Switch
            value={!!opts[o.key]}
            onValueChange={v => setOpts(p => ({ ...p, [o.key]: v }))}
            trackColor={{ true: theme.accent, false: theme.line }}
            thumbColor="#fff"
            accessibilityLabel={o.label}
          />
        </View>
      );
    if (o.type === 'text')
      return (
        <View key={o.key} style={styles.field}>
          <Text style={[type.heading, { color: theme.ink }]}>{o.label}</Text>
          <TextInput
            value={String(opts[o.key] ?? '')}
            onChangeText={v => setOpts(p => ({ ...p, [o.key]: v }))}
            placeholder={o.placeholder}
            placeholderTextColor={theme.muted}
            secureTextEntry={o.secret}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={o.key === 'start' ? 'number-pad' : 'default'}
            style={[styles.input, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.line }]}
            accessibilityLabel={o.label}
          />
        </View>
      );
    return (
      <View key={o.key} style={styles.field}>
        <Text style={[type.heading, { color: theme.ink }]}>{o.label}</Text>
        <View style={styles.chips}>
          {o.choices.map(c => {
            const on = opts[o.key] === c.value;
            return (
              <PressableScale
                key={c.value}
                onPress={() => setOpts(p => ({ ...p, [o.key]: c.value }))}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.chip, { backgroundColor: on ? theme.accent : theme.surface, borderColor: on ? theme.accent : theme.line }]}>
                <Text style={[type.caption, styles.chipText, { color: on ? theme.onAccent : theme.ink2 }]}>{c.label}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title={tool.name} theme={theme} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(350)} style={[styles.where, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Icon name={onDevice ? 'phone' : 'cloud'} size={20} color={onDevice ? theme.accent : theme.link} />
          <Text style={[type.bodySm, styles.flex, { color: theme.ink2 }]}>
            {onDevice
              ? 'Runs on this phone. Your files are not uploaded.'
              : 'Sent over HTTPS to the Fileora server and deleted after download (or within 1 hour).'}
          </Text>
        </Animated.View>

        {files.length === 0 ? (
          <PressableScale onPress={add} accessibilityRole="button" style={[styles.drop, { borderColor: theme.accent, backgroundColor: theme.accent + '12' }]}>
            <View style={[styles.dropIcon, { backgroundColor: theme.accent }]}>
              <Icon name="plus" size={26} color="#fff" width={2.6} />
            </View>
            <Text style={[type.section, { color: theme.ink }]}>Choose {multi ? `${ACCEPT_NOUN[def.accept]}s` : `a ${ACCEPT_NOUN[def.accept]}`}</Text>
            <Text style={[type.bodySm, styles.center, { color: theme.muted }]}>
              {def.min > 1 ? `Select at least ${def.min} files. You can add more after.` : multi ? `Up to ${def.max} files.` : 'From your phone, Google Drive or Downloads.'}
            </Text>
          </PressableScale>
        ) : (
          <View style={styles.list}>
            {files.map((f, i) => (
              <Animated.View key={f.key} entering={FadeIn} exiting={FadeOut} layout={LinearTransition.springify().damping(18)}>
                <View style={[styles.file, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                  <FileThumb path={f.path} mime={f.mime} name={f.name} theme={theme} size={48} />
                  <View style={styles.flex}>
                    <Text style={[type.heading, { color: theme.ink }]} numberOfLines={2}>
                      {f.name}
                    </Text>
                    <Text style={[type.caption, { color: theme.muted }]}>{formatBytes(f.size)}</Text>
                  </View>
                  {multi && files.length > 1 && (
                    <View style={styles.order}>
                      <PressableScale onPress={() => move(i, -1)} disabled={i === 0} accessibilityLabel={`Move ${f.name} up`} hitSlop={6}>
                        <Icon name="up" size={18} color={i === 0 ? theme.line : theme.ink2} />
                      </PressableScale>
                      <PressableScale onPress={() => move(i, 1)} disabled={i === files.length - 1} accessibilityLabel={`Move ${f.name} down`} hitSlop={6}>
                        <Icon name="down" size={18} color={i === files.length - 1 ? theme.line : theme.ink2} />
                      </PressableScale>
                    </View>
                  )}
                  <PressableScale onPress={() => remove(f.key)} accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} hitSlop={8} style={styles.x}>
                    <Icon name="close" size={20} color={theme.ink} width={2.4} />
                  </PressableScale>
                </View>
              </Animated.View>
            ))}
            {(multi || files.length === 0) && files.length < def.max && (
              <PressableScale onPress={add} accessibilityRole="button" style={[styles.addMore, { backgroundColor: theme.surface2 }]}>
                <Icon name="plus" size={20} color={theme.ink} />
                <Text style={[type.button, { color: theme.ink }]}>Add More {ACCEPT_NOUN[def.accept]} Files</Text>
              </PressableScale>
            )}
            {!multi && (
              <PressableScale onPress={add} accessibilityRole="button" style={[styles.addMore, { backgroundColor: theme.surface2 }]}>
                <Text style={[type.button, { color: theme.ink }]}>Choose another file</Text>
              </PressableScale>
            )}
          </View>
        )}

        {(def.options ?? []).length > 0 && <View style={styles.opts}>{def.options!.map(option)}</View>}

        <PressableScale
          onPress={run}
          disabled={!!missing || !!busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!missing }}
          style={[styles.go, { backgroundColor: missing ? theme.surface2 : theme.accent }]}>
          <Text style={[type.button, styles.goText, { color: missing ? theme.muted : theme.onAccent }]}>{missing ?? def.action}</Text>
        </PressableScale>
      </ScrollView>

      {busy && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[StyleSheet.absoluteFill, styles.busy]}>
          <View style={[styles.busyCard, { backgroundColor: theme.surface }]} accessibilityLiveRegion="polite">
            <ActivityIndicator color={theme.accent} size="large" />
            <Text style={[type.heading, styles.center, { color: theme.ink }]}>{busy}</Text>
            {!onDevice && (
              <PressableScale
                onPress={() => {
                  cancel.current.cancelled = true;
                  setBusy(null);
                }}
                accessibilityRole="button">
                <Text style={[type.button, { color: theme.link }]}>Cancel</Text>
              </PressableScale>
            )}
          </View>
        </Animated.View>
      )}

      <ResultSheet file={result} tool={tool.id} theme={theme} onClose={() => setResult(null)} onOpen={openRecord} onNext={goNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  chipText: { fontSize: 13.5 },
  goText: { fontSize: 16.5 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  where: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  drop: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, minHeight: 200, justifyContent: 'center' },
  dropIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  list: { gap: 10 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 10 },
  order: { gap: 8 },
  x: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addMore: { flexDirection: 'row', gap: 8, minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  opts: { gap: 14 },
  field: { gap: 8 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 54 },
  go: { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  busy: { backgroundColor: 'rgba(2,11,23,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  busyCard: { borderRadius: 22, padding: 24, gap: 14, alignItems: 'center', minWidth: 240 },
});
