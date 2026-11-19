/**
 * The app's own screen for every Fileora tool (no website, no web page in between).
 *
 * The tool's options, checks and processing come from the website's own tool code, bundled in
 * the app as the offline engine (src/engine): on-device tools run on this phone, even without
 * internet. API tools (Word to PDF, OCR, AI…) send the files to the Fileora processing server
 * (your VPS, or the website until App Center has the VPS address).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Alert from '../i18n/Alert';
import Text from '../i18n/Text';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import BlobUtil from 'react-native-blob-util';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import FileThumb from '../components/FileThumb';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import ResultSheet from '../components/ResultSheet';
import OptionField from '../components/tool/OptionField';
import PageGrid from '../components/tool/PageGrid';
import RegionEditor from '../components/tool/RegionEditor';
import ResultView from '../components/tool/ResultView';
import { afterTask, prepareInterstitial } from '../ads/ads';
import { toolById } from '../data/tools';
import { call, EngineError, Item, readOutput, RunResult } from '../engine/engine';
import { useToolSession } from '../engine/useToolSession';
import { runServerTool, JobStatus, NeedPassword } from '../lib/serverJob';
import Dialog from '../components/Dialog';
import { uiConfig } from '../remote/remote';
import { Accept, pickFiles, Picked } from '../lib/pick';
import { takePhoto } from '../lib/capture';
import { saveResult } from '../lib/output';
import { openRecord, shareRecord } from '../lib/openFile';
import { useKeepGoing } from '../lib/keepGoing';
import { formatBytes, safeName } from '../store/files';
import { FileRec, store } from '../store/store';
import { RootStackParamList } from '../navigation/types';
import { Theme } from '../theme';
import { type } from '../typography';
import { telemetry } from '../remote/telemetry';
import { busy as task } from '../lib/busy';
import Appear from '../components/Appear';
import { tr, trMsg } from '../i18n/i18n';

const PICK: Record<string, Accept> = { pdf: 'pdf', image: 'image', pdfimage: 'pdfimage', heic: 'heic', svg: 'svg', word: 'word', ppt: 'ppt', excel: 'excel', html: 'html', text: 'text' };
type Done = { title: string; files: FileRec[]; notes: Record<string, string>; extra: RunResult['result'] };

/* the website's thumbStyle (CSS variables) as a native transform: rotation and flips */
function thumbTransform(css: string) {
  const v = (k: string) => {
    const m = new RegExp(`--${k}:\\s*(-?[\\d.]+)`).exec(css);
    return m ? parseFloat(m[1]) : null;
  };
  const rot = v('rot') ?? 0;
  const sx = v('sx') ?? 1;
  const sy = v('sy') ?? 1;
  const rs = v('rs') ?? 1;
  if (!rot && sx === 1 && sy === 1) return undefined;
  return [{ rotate: `${rot}deg` }, { scaleX: sx * rs }, { scaleY: sy * rs }];
}

export default function ProcessScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Process'>>();
  const tool = toolById(params.tool);
  const meta = useMemo(() => ({ id: params.tool, name: tool?.name ?? params.tool, desc: tool?.desc ?? '', exec: tool?.exec ?? 'browser' }), [params.tool, tool]);
  const S = useToolSession(meta);
  const { def, state, thumbs } = S;
  const [vals, setVals] = useState<Record<string, unknown>>({});
  const [opening, setOpening] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [serverLabel, setServerLabel] = useState<string | null>(null);
  // a locked PDF on a server tool: ask for its password and run again (plugin 2.18 / server 2.5)
  const [pwAsk, setPwAsk] = useState<string | null>(null);
  const pdfPw = useRef('');
  const [done, setDone] = useState<Done | null>(null);
  const [single, setSingle] = useState<FileRec | null>(null);
  const [scrollOn, setScrollOn] = useState(true);
  const cancel = useRef({ cancelled: false });
  const rev = useRef('');
  const preloaded = useRef(false);
  const keepGoing = useKeepGoing();

  useEffect(() => {
    prepareInterstitial();
    store.logOpen(params.tool);
    return () => {
      cancel.current.cancelled = true; // leaving the screen stops a server task
    };
  }, [params.tool]);

  // option values: the person's edits stay local; values a tool sets itself (e.g. PDF details read from the file) come from the engine
  useEffect(() => {
    if (!state) return;
    const k = `${state.sid}:${state.rev}`;
    if (k !== rev.current) {
      rev.current = k;
      setVals(state.opts);
    }
  }, [state]);

  const addPicked = async (picked: Picked[]) => {
    if (!picked.length) return;
    setOpening('Opening…');
    try {
      const notes = await S.addFiles(picked, setOpening);
      if (notes.length) Alert.alert(meta.name, notes.join('\n\n'));
    } catch (e) {
      Alert.alert('Couldn’t open the file', e instanceof Error ? e.message : String(e));
    } finally {
      setOpening(null);
    }
  };
  // files handed over from another screen ("Keep going", Files, Share to Fileora)
  useEffect(() => {
    if (!def || preloaded.current || (!params.fileIds?.length && !params.files?.length)) return;
    preloaded.current = true;
    const picked: Picked[] = (params.fileIds ?? [])
      .map(id => store.get().files.find(f => f.id === id))
      .filter((f): f is FileRec => !!f)
      .map(f => ({ key: f.id, name: f.name, size: f.size, path: f.path, mime: f.mime }));
    (params.files ?? []).forEach((f, i) => picked.push({ key: `in${i}-${Date.now()}`, name: f.name, size: f.size ?? 0, path: f.path, mime: f.mime }));
    addPicked(picked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  if (!tool) return null;

  const items: Item[] = state?.items ?? [];
  const accept = def ? PICK[def.code && def.codeText?.pick ? def.codeText.pick : def.accept] : undefined;
  const maxFiles = def?.max || 0;
  const canAdd = !!def && (def.multi ? !maxFiles || items.length < maxFiles : true);
  const pickMore = async () => {
    if (!def || !accept) return;
    try {
      await addPicked(await pickFiles(accept, def.multi));
    } catch (e) {
      Alert.alert('Couldn’t open the file', e instanceof Error ? e.message : String(e));
    }
  };
  const photo = async () => {
    try {
      const imgs = await takePhoto();
      await addPicked(imgs.map((m, i) => ({ key: `cam${Date.now()}${i}`, name: m.name, size: m.size, path: m.path, mime: m.mime })));
    } catch (e) {
      Alert.alert('Camera', e instanceof Error ? e.message : String(e));
    }
  };
  const change = (fid: string, v: unknown) => {
    setVals(o => ({ ...o, [fid]: v }));
    S.setOpt(fid, v).catch(() => {});
  };
  const order = (ids: string[]) => S.setItems(ids).catch(() => {});
  const move = (i: number, d: number) => {
    const ids = items.map(x => x.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    order(ids);
  };

  const run = async () => {
    if (!state?.ok || working) return;
    const end = task.start(); // maintenance / force update wait for this task
    try {
      await runTask();
    } finally {
      end();
    }
  };
  const runTask = async () => {
    if (!def || !S.sid.current) return;
    const sid = S.sid.current;
    const bytesIn = items.reduce((s, i) => s + (i.size || 0), 0);
    const signal = { cancelled: false };
    cancel.current = signal;
    setWorking(true);
    setServerLabel(null);
    S.setProgress({ f: 0, label: def.server ? 'Getting the files ready' : 'Getting ready' });
    try {
      const r = await call<RunResult>('run', { sid }, 30 * 60000);
      if (signal.cancelled) return;
      const files: FileRec[] = [];
      const notes: Record<string, string> = {};
      let extra: RunResult['result'] = r.result ?? null;
      if (r.server) {
        const up = (r.fids ?? []).map(fid => S.fileFor(fid)).filter((f): f is NonNullable<typeof f> => !!f).map(f => ({ uri: f.path, name: f.name, mime: f.mime }));
        for (const u of r.upload ?? []) {
          const p = `${BlobUtil.fs.dirs.CacheDir}/${Date.now()}-${safeName(u.name)}`;
          await readOutput(u.oid, u.size, p);
          up.push({ uri: p, name: u.name, mime: u.type });
        }
        setServerLabel('Uploading…');
        const label = (s: JobStatus) =>
          s.status === 'queued' ? (s.ahead ? tr('Waiting in line, {n} ahead of you', { n: s.ahead }) : 'Waiting in line') : s.status === 'running' ? tr('{verb} on the server…', { verb: tr(def.verb) }) : 'Downloading the result…';
        const options = { ...(r.options ?? {}), ...(pdfPw.current ? { opw: pdfPw.current } : {}) };
        const res = await runServerTool(tool.id, up, options, st => !signal.cancelled && setServerLabel(label(st)), signal, r.url);
        setServerLabel('Saving…');
        const rec = await saveResult({ name: res.name, fromPath: res.path, move: true, tool: tool.id, bytesIn });
        files.push(rec);
        if (res.note) notes[rec.id] = res.note;
        if (res.text) extra = { md: res.text, title: r.textTitle || 'Your text is ready' };
      } else {
        const outs = r.outputs ?? [];
        for (const [n, o] of outs.entries()) {
          S.setProgress({ f: 1, label: outs.length > 1 ? `Saving ${n + 1} of ${outs.length}` : 'Saving' });
          const tmp = `${BlobUtil.fs.dirs.CacheDir}/${Date.now()}-${n}-${safeName(o.name)}`;
          await readOutput(o.oid, o.size, tmp);
          const rec = await saveResult({ name: o.name, fromPath: tmp, move: true, tool: tool.id, bytesIn, log: n === 0 });
          files.push(rec);
          if (o.note) notes[rec.id] = o.note;
        }
        call('outFree', { oids: outs.map(o => o.oid) }).catch(() => {});
      }
      setWorking(false);
      await afterTask(); // App Center → Ads: maybe a full-screen ad first, within its limits
      const title = extra?.title || (files.length > 1 ? tr('{n} files are ready', { n: files.length }) : 'Your file is ready');
      setDone({ title, files, notes, extra });
      if (files.length === 1 && !extra?.md && !extra?.text && !extra?.diff && !extra?.palette) setSingle(files[0]);
    } catch (e) {
      setWorking(false);
      if (signal.cancelled || (e instanceof EngineError && e.message === 'cancelled')) return;
      const m = e instanceof Error ? e.message : String(e);
      telemetry.track('failed', tool.id, bytesIn, m);
      if (e instanceof NeedPassword) {
        setPwAsk(m);
        return;
      }
      Alert.alert(`${tool.name} didn’t work`, m);
    }
  };
  const stop = () => {
    cancel.current.cancelled = true;
    if (S.sid.current) call('cancel', { sid: S.sid.current }).catch(() => {});
    setWorking(false);
  };
  const startOver = () => {
    pdfPw.current = '';
    setDone(null);
    setSingle(null);
    order([]);
  };

  const onDevice = def ? !def.server : tool.exec !== 'server';
  // App Center → Manage → Processing screen: detailed (bar and steps), simple (spinner) or off (spinner in the button)
  const progressMode = uiConfig().progress[onDevice ? 'browser' : 'server'];
  const transform = state?.thumbStyle ? thumbTransform(state.thumbStyle) : undefined;

  const fileCard = (it: Item, i: number) => {
    const local = S.fileFor(it.fid);
    const t = thumbs[it.id];
    const ord = !!def && (def.ordered || !!def.slots) && items.length > 1;
    return (
      <Animated.View key={it.id} entering={FadeIn} exiting={FadeOut} layout={LinearTransition.duration(220)}>
        {def?.slots ? <Text style={[type.overline, styles.slot, { color: theme.muted }]}>{def.slots[i] ?? ''}</Text> : null}
        <View style={[styles.file, { backgroundColor: theme.surface, borderColor: it.err ? theme.danger : theme.line }]}>
          <View style={[styles.thumb, { backgroundColor: theme.surface2 }]}>
            {t ? (
              <Image source={{ uri: t }} style={[styles.thumbImg, transform && { transform }]} resizeMode="contain" accessibilityIgnoresInvertColors />
            ) : local ? (
              <FileThumb path={local.path} mime={local.mime} name={local.name} theme={theme} size={52} />
            ) : (
              <Icon name="file" size={22} color={theme.muted} />
            )}
            {ord && !def?.slots ? (
              <View style={[styles.ord, { backgroundColor: theme.ink }]}>
                <Text style={[styles.ordText, { color: theme.bg }]}>{i + 1}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.flex}>
            <Text style={[type.heading, { color: theme.ink }]} numberOfLines={2}>
              {it.name}
            </Text>
            <Text style={[type.caption, { color: it.err ? theme.danger : theme.muted }]} numberOfLines={2}>
              {it.ready || it.err ? it.meta : `${formatBytes(it.size)}, reading…`}
            </Text>
          </View>
          {ord && (
            <View style={styles.order}>
              <PressableScale onPress={() => move(i, -1)} disabled={i === 0} accessibilityLabel={tr('Move {name} up', { name: it.name })} hitSlop={6}>
                <Icon name="up" size={18} color={i === 0 ? theme.line : theme.ink2} />
              </PressableScale>
              <PressableScale onPress={() => move(i, 1)} disabled={i === items.length - 1} accessibilityLabel={tr('Move {name} down', { name: it.name })} hitSlop={6}>
                <Icon name="down" size={18} color={i === items.length - 1 ? theme.line : theme.ink2} />
              </PressableScale>
            </View>
          )}
          <PressableScale onPress={() => order(items.filter(x => x.id !== it.id).map(x => x.id))} accessibilityRole="button" accessibilityLabel={`Remove ${it.name}`} hitSlop={8} style={styles.x}>
            <Icon name="close" size={20} color={theme.ink} width={2.4} />
          </PressableScale>
        </View>
      </Animated.View>
    );
  };

  const inputArea = () => {
    if (!def || !state) return null;
    // Text to PDF uses the same box for plain text (any language), HTML Code to PDF for code
    const plain = !!def.codeText && def.codeText.pick === 'text';
    if (def.code)
      return (
        <View style={styles.block}>
          <Text style={[type.heading, { color: theme.ink }]}>{plain ? def.codeText?.label : 'Your HTML code'}</Text>
          <TextInput
            value={String(vals.html ?? '')}
            onChangeText={t => change('html', t)}
            multiline
            placeholder={def.codeText?.placeholder || '<!doctype html>\n<h1>Hello</h1>'}
            placeholderTextColor={theme.muted}
            autoCapitalize={plain ? 'sentences' : 'none'}
            autoCorrect={plain}
            spellCheck={plain}
            textAlignVertical="top"
            style={[styles.code, plain && styles.plainText, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.line }]}
            accessibilityLabel={plain ? def.codeText?.label : 'HTML code'}
          />
          <PressableScale onPress={pickMore} accessibilityRole="button" style={[styles.addMore, { backgroundColor: theme.surface2 }]}>
            <Icon name="file" size={18} color={theme.ink} />
            <Text style={[type.button, { color: theme.ink }]}>{def.codeText?.open || 'Open an .html file'}</Text>
          </PressableScale>
        </View>
      );
    if (def.accept === 'url')
      return (
        <View style={styles.block}>
          <Text style={[type.heading, { color: theme.ink }]}>Web address</Text>
          <TextInput
            value={String(vals.url ?? '')}
            onChangeText={t => change('url', t.trim())}
            placeholder={tr('https://example.com/article')}
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[styles.input, { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.line }]}
            accessibilityLabel={tr('Web address')}
          />
          <Text style={[type.caption, { color: theme.muted }]}>The page is opened on the processing server and saved exactly as it appears there.</Text>
        </View>
      );
    if (!items.length) {
      const what = def.dropText || (def.slots ? `${def.slots.length} ${def.nouns}` : def.multi ? def.nouns : `${/^[aeiou]/i.test(def.noun) ? 'an' : 'a'} ${def.noun}`);
      return (
        <View style={styles.block}>
          <PressableScale onPress={pickMore} accessibilityRole="button" style={[styles.drop, { borderColor: theme.accent, backgroundColor: theme.accent + '12' }]}>
            <View style={[styles.dropIcon, { backgroundColor: theme.accent }]}>
              <Icon name="plus" size={26} color="#fff" width={2.6} />
            </View>
            <Text style={[type.section, styles.center, { color: theme.ink }]}>{tr('Choose {things}', { things: tr(what) })}</Text>
            <Text style={[type.bodySm, styles.center, { color: theme.muted }]}>
              {def.min > 1 ? tr('Select at least {n} files.', { n: def.min }) : 'From your phone, Google Drive or Downloads.'} {onDevice ? 'Processed on this phone.' : ''}
            </Text>
          </PressableScale>
          {def.camera && (
            <PressableScale onPress={photo} accessibilityRole="button" style={[styles.addMore, { backgroundColor: theme.surface2 }]}>
              <Icon name="camera" size={18} color={theme.ink} />
              <Text style={[type.button, { color: theme.ink }]}>Take a photo</Text>
            </PressableScale>
          )}
        </View>
      );
    }
    const head = (
      <View style={styles.listHead}>
        <Text style={[type.caption, styles.flex, { color: theme.muted }]}>
          {items.length} {items.length === 1 ? def.noun : def.nouns} · {formatBytes(items.reduce((a, f) => a + (f.size || 0), 0))}
        </Text>
        {def.ordered && items.length > 1 && !def.slots && (
          <PressableScale onPress={() => order([...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(x => x.id))} hitSlop={8} accessibilityRole="button" style={[styles.pill, { borderColor: theme.line }]}>
            <Icon name="sort" size={14} color={theme.ink2} />
            <Text style={[type.caption, styles.bold, { color: theme.ink2 }]}>A to Z</Text>
          </PressableScale>
        )}
        {def.slots && items.length === 2 && (
          <PressableScale onPress={() => order(items.map(x => x.id).reverse())} hitSlop={8} accessibilityRole="button" style={[styles.pill, { borderColor: theme.line }]}>
            <Icon name="refresh" size={14} color={theme.ink2} />
            <Text style={[type.caption, styles.bold, { color: theme.ink2 }]}>Swap</Text>
          </PressableScale>
        )}
        <PressableScale onPress={() => order([])} hitSlop={8} accessibilityRole="button" style={[styles.pill, { borderColor: theme.line }]}>
          <Icon name="close" size={14} color={theme.danger} width={2.6} />
          <Text style={[type.caption, styles.bold, { color: theme.danger }]}>{def.multi ? 'Remove all' : 'Remove'}</Text>
        </PressableScale>
      </View>
    );
    const more = canAdd && (
      <PressableScale onPress={pickMore} accessibilityRole="button" style={[styles.addMore, { backgroundColor: theme.surface2 }]}>
        <Icon name={def.multi ? 'plus' : 'refresh'} size={18} color={theme.ink} />
        <Text style={[type.button, { color: theme.ink }]}>{def.multi ? (def.slots && def.slots[items.length] ? `Add: ${def.slots[items.length]}` : tr('Add more {things}', { things: tr(def.nouns) })) : 'Choose another file'}</Text>
      </PressableScale>
    );
    if (def.pages) {
      const it = items[0];
      return (
        <View style={styles.block}>
          {head}
          {state.pages ? (
            <PageGrid
              pages={state.pages}
              total={state.pageCount}
              thumbs={thumbs}
              theme={theme}
              onChange={p => S.setPages(p.map(x => ({ key: x.key, rot: x.rot }))).catch(() => {})}
              onReset={() => S.setPages(Array.from({ length: state.pageCount }, (_, i) => ({ key: `p${i}`, rot: 0 }))).catch(() => {})}
            />
          ) : (
            <>
              {fileCard(it, 0)}
              {!it.err && <Loading theme={theme} text="Loading pages…" />}
            </>
          )}
          {more}
        </View>
      );
    }
    if (def.regions) {
      const src = thumbs.source;
      return (
        <View style={styles.block}>
          {head}
          {state.regionsSkip || !state.source || state.source.err ? items.map(fileCard) : null}
          {state.regionsSkip ? (
            state.regionsNote ? <Text style={[type.caption, { color: theme.ink2 }]}>{state.regionsNote}</Text> : null
          ) : state.source?.err ? (
            <View style={[styles.note, { backgroundColor: theme.warnBg, borderColor: theme.warnLine }]}>
              <Icon name="info" size={18} color={theme.warnInk} />
              <Text style={[type.bodySm, styles.flex, { color: theme.ink }]}>{state.source.err}</Text>
            </View>
          ) : state.source?.ready && src && state.regions ? (
            <RegionEditor src={src} w={state.source.w} h={state.source.h} rects={state.regions} multi={def.regions.multi} note={def.regions.after} theme={theme} onChange={r => S.setRegions(r).catch(() => {})} onScrollLock={l => setScrollOn(!l)} />
          ) : (
            <Loading theme={theme} text="Preparing the preview…" />
          )}
          {more}
        </View>
      );
    }
    return (
      <View style={styles.block}>
        {head}
        {items.map(fileCard)}
        {more}
        {def.camera && (
          <PressableScale onPress={photo} accessibilityRole="button" style={[styles.addMore, { backgroundColor: theme.surface2 }]}>
            <Icon name="camera" size={18} color={theme.ink} />
            <Text style={[type.button, { color: theme.ink }]}>Take another photo</Text>
          </PressableScale>
        )}
      </View>
    );
  };

  const shownOpts = (def?.opts ?? []).filter(f => f.id && state?.show[f.id] !== false && f.id !== 'url' && !(def?.code && f.id === 'html'));
  const progress = S.progress;

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title={tool.name} theme={theme} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={scrollOn}>
        {S.error ? (
          <View style={[styles.note, { backgroundColor: theme.warnBg, borderColor: theme.warnLine }]}>
            <Icon name="info" size={20} color={theme.warnInk} />
            <Text style={[type.body, styles.flex, { color: theme.ink }]}>{S.error}</Text>
          </View>
        ) : !def || !state ? (
          <Loading theme={theme} text="Opening the tool…" />
        ) : done ? (
          <ResultView
            title={done.title}
            files={done.files}
            notes={done.notes}
            extra={done.extra ?? null}
            tool={tool.id}
            theme={theme}
            onOpen={openRecord}
            onShare={shareRecord}
            onNext={(id, f) => keepGoing(id, f)}
            onAgain={() => setDone(null)}
            onStartOver={startOver}
          />
        ) : (
          <>
            <Appear duration={350} style={[styles.where, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Icon name={onDevice ? 'phone' : 'cloud'} size={20} color={onDevice ? theme.accent : theme.link} />
              <Text style={[type.bodySm, styles.flex, { color: theme.ink2 }]}>
                {onDevice ? 'Runs on this phone, also offline. Your files are not uploaded.' : 'Sent over HTTPS to the Fileora processing server and deleted after download (or within 1 hour).'}
              </Text>
            </Appear>
            {def.tip || tool.desc ? <Text style={[type.bodySm, { color: theme.muted }]}>{def.tip || tool.desc}</Text> : null}
            {inputArea()}
            {shownOpts.length > 0 && (
              <View style={styles.opts}>
                <Text style={[type.section, { color: theme.ink }]}>Options</Text>
                {shownOpts.map(f => (
                  <OptionField
                    key={f.id}
                    f={f}
                    value={f.type === 'image' || f.type === 'signature' ? state.opts[f.id] : vals[f.id]}
                    help={state.help[f.id]}
                    theme={theme}
                    onChange={v => change(f.id, v)}
                    onImage={file => S.setImage(f.id, file).catch(e => Alert.alert('Picture', e instanceof Error ? e.message : String(e)))}
                    onSignature={v => S.signature(f.id, v).catch(e => Alert.alert('Signature', e instanceof Error ? e.message : String(e)))}
                    onScrollLock={l => setScrollOn(!l)}
                  />
                ))}
              </View>
            )}
            <PressableScale
              onPress={run}
              disabled={!state.ok || working}
              accessibilityRole="button"
              accessibilityState={{ disabled: !state.ok }}
              accessibilityHint={state.ok || !state.hint ? undefined : trMsg(state.hint)}
              style={[styles.go, { backgroundColor: state.ok || working ? theme.accent : theme.surface2 }]}>
              {working && progressMode === 'off' ? (
                <View style={styles.goBusy}>
                  <ActivityIndicator color={theme.onAccent} />
                  <Text style={[type.button, styles.goText, { color: theme.onAccent }]}>{def.verb}…</Text>
                </View>
              ) : (
                <Text style={[type.button, styles.goText, { color: state.ok ? theme.onAccent : theme.muted }]}>{def.cta}</Text>
              )}
            </PressableScale>
            <Text style={[type.caption, styles.center, { color: state.ok ? theme.muted : theme.ink2 }]}>
              {(state.hint && trMsg(state.hint)) || (onDevice ? 'Processed on your phone. Nothing is uploaded.' : 'Files are deleted from the server after download.')}
            </Text>
          </>
        )}
      </ScrollView>

      {(opening || (working && progressMode !== 'off')) && (
        <Appear duration={250} rise={false} exiting={FadeOut} style={[StyleSheet.absoluteFill, styles.busy]}>
          <View style={[styles.busyCard, { backgroundColor: theme.surface }]} accessibilityLiveRegion="polite">
            {opening ? (
              <>
                <ActivityIndicator color={theme.accent} size="large" />
                <Text style={[type.heading, styles.center, { color: theme.ink }]}>{opening}</Text>
              </>
            ) : (
              <>
                <Text style={[type.section, styles.center, { color: theme.ink }]}>{def?.verb ?? 'Working'}…</Text>
                {progressMode === 'simple' ? (
                  <ActivityIndicator color={theme.accent} size="large" />
                ) : (
                  <>
                    <View style={[styles.bar, { backgroundColor: theme.surface2 }]}>
                      {serverLabel || !progress || progress.f < 0 ? (
                        <ActivityIndicator color={theme.accent} />
                      ) : (
                        <View style={[styles.barFill, { width: `${Math.round(Math.min(1, Math.max(0.04, progress.f)) * 100)}%`, backgroundColor: theme.accent }]} />
                      )}
                    </View>
                    <Text style={[type.bodySm, styles.center, { color: theme.ink2 }]}>{serverLabel ?? progress?.label ?? ''}</Text>
                  </>
                )}
                <Text style={[type.caption, styles.center, { color: theme.muted }]}>{onDevice ? 'Keep Fileora open until it finishes.' : 'Your files are processed securely, then deleted.'}</Text>
                <PressableScale onPress={stop} accessibilityRole="button" hitSlop={8}>
                  <Text style={[type.button, { color: theme.link }]}>Cancel</Text>
                </PressableScale>
              </>
            )}
          </View>
        </Appear>
      )}

      <Dialog
        visible={!!pwAsk}
        title="This PDF needs its password"
        message={pwAsk ?? ''}
        label="PDF password"
        secure
        okLabel="Try again"
        theme={theme}
        onCancel={() => setPwAsk(null)}
        onOk={text => {
          pdfPw.current = text;
          setPwAsk(null);
          run();
        }}
      />

      <ResultSheet file={single} tool={tool.id} theme={theme} onClose={() => setSingle(null)} onOpen={openRecord} onNext={(id, f) => keepGoing(id, f)} />
    </View>
  );
}

function Loading({ theme, text }: { theme: Theme; text: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.accent} />
      <Text style={[type.bodySm, { color: theme.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  bold: { fontWeight: '700' },
  goText: { fontSize: 16.5 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  where: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  block: { gap: 10 },
  drop: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 20, padding: 24, alignItems: 'center', gap: 8, minHeight: 190, justifyContent: 'center' },
  dropIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, minHeight: 32 },
  slot: { marginBottom: 4, marginLeft: 4 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 10 },
  thumb: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 56, height: 56 },
  ord: { position: 'absolute', left: 3, top: 3, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ordText: { fontSize: 10.5, fontWeight: '800' },
  order: { gap: 8 },
  x: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addMore: { flexDirection: 'row', gap: 8, minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50, fontSize: 16 },
  plainText: { fontFamily: undefined, fontSize: 16, lineHeight: 23 },
  code: { borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 240, maxHeight: 420, fontSize: 13, fontFamily: 'monospace' },
  note: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'flex-start' },
  opts: { gap: 16, marginTop: 4 },
  goBusy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  go: { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  loading: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  busy: { backgroundColor: 'rgba(2,11,23,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  busyCard: { borderRadius: 22, padding: 24, gap: 14, alignItems: 'center', minWidth: 260, maxWidth: 340, width: '100%' },
  bar: { height: 10, borderRadius: 5, width: '100%', overflow: 'hidden', justifyContent: 'center' },
  barFill: { height: 10, borderRadius: 5 },
});
