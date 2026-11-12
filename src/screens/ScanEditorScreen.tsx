/**
 * Scanner editor: border (automatic page edges, Full border / Detect border, drag the corners
 * with a magnifier) → filters (None, Photo, Document, Black and White, Monochrome), rotate,
 * distortion fix, add pages → "Scan complete" (name + Save as PDF) or, in Convert PDFs, Save as PDF.
 * The image work happens on the phone, in an offline page (src/scanner/editor.html).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, StackActions, useNavigation, usePreventRemove, useRoute } from '@react-navigation/native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import BlobUtil from 'react-native-blob-util';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import Dialog from '../components/Dialog';
import ActionSheet, { SheetAction } from '../components/ActionSheet';
import ResultSheet from '../components/ResultSheet';
import { EDITOR_HTML } from '../scanner/editorHtml';
import { pickPhotos, takePhoto } from '../lib/capture';
import { pickFiles } from '../lib/pick';
import { native } from '../lib/native';
import { imagesToPdf } from '../lib/pdf';
import { saveResult, stamp } from '../lib/output';
import { confirmDiscard, openRecord } from '../lib/openFile';
import { useKeepGoing } from '../lib/keepGoing';
import { FileRec, store } from '../store/store';
import { RootStackParamList } from '../navigation/types';
import { brand, Theme } from '../theme';
import { type } from '../typography';

const WV = WebView<object>;
type Filter = 'none' | 'photo' | 'document' | 'bw' | 'mono';
type Page = { src: string; mime: string; w?: number; h?: number; quad?: number[][]; detected?: boolean; filter: Filter; rot: number; distortion: boolean };
type Msg = { t: string; id?: number; [k: string]: unknown };

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'photo', label: 'Photo' },
  { id: 'document', label: 'Document' },
  { id: 'bw', label: 'Black and White' },
  { id: 'mono', label: 'Monochrome' },
];
// the editor is always dark, like a camera
const D = { bg: '#0B0F14', bar: '#141A21', ink: '#FFFFFF', muted: '#9AA6B4', line: '#26303B', accent: brand.green };

const SAVE_AS_PDF = { label: 'Save as PDF', value: true };
const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ScanEditorScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ScanEditor'>>();
  const convert = params.mode === 'convert';
  const doc = params.docId ? store.get().docs.find(d => d.id === params.docId) : undefined;
  const keepGoing = useKeepGoing();

  const web = useRef<WebView<object>>(null);
  const waiters = useRef(new Map<number, (m: Msg) => void>());
  const seq = useRef(1);
  const [ready, setReady] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [cur, setCur] = useState(0);
  const [step, setStep] = useState<'border' | 'filter'>('border');
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [sheet, setSheet] = useState<SheetAction[] | null>(null);
  const [result, setResult] = useState<{ file: FileRec; docId?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const page = pages[cur];

  /* ---------- talking to the editor page ---------- */
  const send = useCallback((m: Msg) => web.current?.postMessage(JSON.stringify(m)), []);
  const call = useCallback(
    (m: Msg) =>
      new Promise<Msg>((resolve, reject) => {
        const id = seq.current++;
        waiters.current.set(id, r => (r.t === 'error' ? reject(new Error(String(r.message))) : resolve(r)));
        send({ ...m, id });
      }),
    [send],
  );
  const onMessage = (e: WebViewMessageEvent) => {
    let m: Msg;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.t === 'ready') {
      send({ t: 'init', bg: D.bg, accent: D.accent });
      setReady(true);
    } else if (m.t === 'quadChanged') {
      setPages(ps => ps.map((p, i) => (i === curRef.current ? { ...p, quad: m.quad as number[][] } : p)));
    } else if (m.id && waiters.current.has(m.id)) {
      waiters.current.get(m.id)!(m);
      waiters.current.delete(m.id);
    }
  };
  const curRef = useRef(0);
  curRef.current = cur;

  const dataUrl = async (p: Page) => `data:${p.mime};base64,${await BlobUtil.fs.readFile(p.src, 'base64')}`;
  const loadPage = useCallback(
    async (i: number, list: Page[], mode: 'border' | 'filter') => {
      const p = list[i];
      if (!p) return;
      try {
        const r = await call({ t: 'load', url: await dataUrl(p), quad: p.quad, w: p.w, h: p.h, detected: p.detected, filter: p.filter, rot: p.rot, distortion: p.distortion, mode });
        setPages(ps => ps.map((x, j) => (j === i ? { ...x, w: r.w as number, h: r.h as number, quad: r.quad as number[][], detected: r.detected as boolean } : x)));
        setHint(mode === 'border' && !p.quad && !r.detected ? 'Page edges not found: drag the corners to the page.' : null);
        if (mode === 'filter') setThumbs((await call({ t: 'thumbs' })).items as Record<string, string>);
      } catch (e) {
        Alert.alert('This image couldn’t be opened', e instanceof Error ? e.message : String(e));
      }
    },
    [call],
  );

  /* ---------- getting pages ---------- */
  const addFrom = useCallback(
    async (source: 'camera' | 'gallery' | 'pdf' | 'images'): Promise<Page[]> => {
      const last = pages[pages.length - 1];
      const base = { filter: last?.filter ?? (convert ? 'document' : 'none'), rot: 0, distortion: true } as const;
      if (source === 'camera') return (await takePhoto()).map(i => ({ ...base, src: i.path, mime: i.mime }));
      if (source === 'gallery') return (await pickPhotos(0)).map(i => ({ ...base, src: i.path, mime: i.mime }));
      if (source === 'images') return (await pickFiles('jpgpng', true)).map(i => ({ ...base, src: i.path, mime: i.mime }));
      const pdfs = await pickFiles('pdf', true);
      const out: Page[] = [];
      for (const f of pdfs) {
        setBusy(`Opening ${f.name}…`);
        try {
          for (const pg of await native.renderPdf(f.path, 2200)) out.push({ ...base, src: pg.path, mime: 'image/jpeg' });
        } finally {
          setBusy(null);
        }
      }
      return out;
    },
    [pages, convert],
  );

  const append = useCallback(
    async (source: 'camera' | 'gallery' | 'pdf' | 'images') => {
      try {
        const more = await addFrom(source);
        if (!more.length) return false;
        const list = [...pages, ...more].slice(0, 60);
        setPages(list);
        setCur(pages.length);
        setStep('border');
        await loadPage(pages.length, list, 'border');
        return true;
      } catch (e) {
        setBusy(null);
        Alert.alert('Couldn’t add the page', e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [addFrom, pages, loadPage],
  );

  // first pages: given (shared images), or from the chosen source
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    (async () => {
      if (params.pages?.length) {
        const list = params.pages.map(p => ({ src: p.path, mime: p.mime ?? 'image/jpeg', filter: (convert ? 'document' : 'none') as Filter, rot: 0, distortion: true }));
        setPages(list);
        await loadPage(0, list, 'border');
      } else if (!(await append(params.source ?? 'camera'))) nav.goBack();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /* ---------- leaving without saving ---------- */
  usePreventRemove(pages.length > 0 && !saved, ({ data }) => {
    confirmDiscard(() => {
      setSaved(true);
      setTimeout(() => nav.dispatch(data.action), 0);
    }, pages.length);
  });

  /* ---------- actions ---------- */
  const goStep = async (s: 'border' | 'filter') => {
    setStep(s);
    send({ t: 'mode', mode: s });
    setHint(null);
    if (s === 'filter') setThumbs((await call({ t: 'thumbs' }).catch((): Msg => ({ t: 'thumbs', items: {} }))).items as Record<string, string>);
  };
  const setQuad = async (which: 'full' | 'detect') => {
    const r = await call({ t: 'quad', which });
    setPages(ps => ps.map((p, i) => (i === cur ? { ...p, quad: r.quad as number[][], detected: r.detected as boolean } : p)));
    setHint(which === 'detect' && !r.detected ? 'Page edges not found: drag the corners to the page.' : null);
  };
  const update = async (patch: Partial<Page>, refreshThumbs = false) => {
    const next = { ...page, ...patch };
    setPages(ps => ps.map((p, i) => (i === cur ? next : p)));
    send({ t: 'set', filter: next.filter, rot: next.rot, distortion: next.distortion });
    if (refreshThumbs) setThumbs((await call({ t: 'thumbs' }).catch((): Msg => ({ t: 'thumbs', items: {} }))).items as Record<string, string>);
  };
  const go = async (i: number) => {
    if (i < 0 || i >= pages.length || i === cur) return;
    setCur(i);
    setStep('border');
    await loadPage(i, pages, 'border');
  };
  const discardCurrent = () =>
    confirmDiscard(async () => {
      const list = pages.filter((_, i) => i !== cur);
      if (!list.length) {
        setSaved(true);
        setPages([]);
        setTimeout(() => nav.goBack(), 0);
        return;
      }
      const i = Math.min(cur, list.length - 1);
      setPages(list);
      setCur(i);
      setStep('border');
      await loadPage(i, list, 'border');
    });
  const addPage = () => {
    if (convert)
      setSheet([
        { key: 'img', label: 'Images', sub: 'JPG or PNG', icon: 'image', onPress: () => append('images') },
        { key: 'pdf', label: 'PDF', sub: 'Every page is added', icon: 'pdf', onPress: () => append('pdf') },
      ]);
    else
      setSheet([
        { key: 'cam', label: 'Camera', icon: 'camera', onPress: () => append('camera') },
        { key: 'gal', label: 'Gallery', icon: 'image', onPress: () => append('gallery') },
      ]);
  };
  const confirmPage = async () => {
    if (cur < pages.length - 1) await go(cur + 1);
    else setAsking(true);
  };

  /* ---------- saving ---------- */
  const save = async (name: string, asPdf: boolean) => {
    setAsking(false);
    const outs: string[] = [];
    try {
      for (let i = 0; i < pages.length; i++) {
        setBusy(`Saving page ${i + 1} of ${pages.length}…`);
        const p = pages[i];
        await call({ t: 'load', url: await dataUrl(p), quad: p.quad, w: p.w, h: p.h, detected: p.detected, filter: p.filter, rot: p.rot, distortion: p.distortion, mode: 'filter' });
        const r = await call({ t: 'export', maxSide: 2400, quality: 0.88 });
        const path = `${BlobUtil.fs.dirs.CacheDir}/scan-${Date.now()}-${i}.jpg`;
        await BlobUtil.fs.writeFile(path, String(r.url).split(',')[1], 'base64');
        outs.push(path);
      }
      const bytesIn = (await Promise.all(outs.map(p => BlobUtil.fs.stat(p).then(s => Number(s.size)).catch(() => 0)))).reduce((a, b) => a + b, 0);
      const safe = name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || `Scan ${stamp()}`;

      if (convert) {
        setBusy('Making the PDF…');
        const pdf = await imagesToPdf(outs.map(path => ({ path, mime: 'image/jpeg' })));
        const rec = await saveResult({ name: `${safe}.pdf`, base64: pdf.base64, mime: 'application/pdf', source: 'convert', tool: 'scan', bytesIn, pages: pdf.pages });
        outs.forEach(p => BlobUtil.fs.unlink(p).catch(() => {}));
        setBusy(null);
        setSaved(true);
        setResult({ file: rec });
        return;
      }

      const base = `scan-${stamp()}`;
      const ids: string[] = [];
      let first: FileRec | null = null;
      for (let i = 0; i < outs.length; i++) {
        const rec = await saveResult({ name: `${base}-${i + 1}.jpg`, fromPath: outs[i], move: true, mime: 'image/jpeg', source: 'scan-image', publish: false });
        first = first ?? rec;
        ids.push(rec.id);
      }
      let docId = doc?.id;
      if (doc) store.updateDoc(doc.id, { name: safe, pageIds: [...(store.get().docs.find(d => d.id === doc.id)?.pageIds ?? []), ...ids] });
      else docId = store.addDoc({ name: safe, pageIds: ids }).id;
      let pdfRec: FileRec | null = null;
      if (asPdf && docId) {
        setBusy('Making the PDF…');
        const d = store.get().docs.find(x => x.id === docId)!;
        const files = d.pageIds.map(id => store.get().files.find(f => f.id === id)).filter((f): f is FileRec => !!f);
        const pdf = await imagesToPdf(files.map(f => ({ path: f.path, mime: f.mime })));
        pdfRec = await saveResult({ name: `${safe}.pdf`, base64: pdf.base64, mime: 'application/pdf', source: 'scan', tool: 'scan', bytesIn, pages: pdf.pages });
        if (d.pdfId) await store.trashFile(d.pdfId);
        store.updateDoc(docId, { pdfId: pdfRec.id });
      } else store.logDone('scan', bytesIn);
      setBusy(null);
      setSaved(true);
      setResult({ file: pdfRec ?? first!, docId });
    } catch (e) {
      setBusy(null);
      outs.forEach(p => BlobUtil.fs.unlink(p).catch(() => {}));
      Alert.alert('The scan couldn’t be saved', e instanceof Error ? e.message : String(e));
    }
  };

  const closeResult = () => {
    const r = result;
    setResult(null);
    if (r?.docId && !convert && !params.docId) nav.dispatch(StackActions.replace('ScanDoc', { id: r.docId }));
    else nav.goBack();
  };

  /* ---------- UI ---------- */
  const tool = (icon: IconName, label: string, onPress: () => void, sub?: string) => (
    <PressableScale key={label} onPress={onPress} accessibilityRole="button" accessibilityLabel={sub ? `${label} ${sub}` : label} style={styles.tool}>
      <Icon name={icon} size={22} color={D.ink} />
      <Text style={[type.caption, styles.toolText]} numberOfLines={2}>
        {label}
        {sub ? `\n${sub}` : ''}
      </Text>
    </PressableScale>
  );

  return (
    <View style={[styles.flex, { backgroundColor: D.bg }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <PressableScale onPress={() => nav.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back" style={styles.hBtn}>
          <Icon name="back" size={24} color={D.ink} />
        </PressableScale>
        <View style={styles.pager}>
          {pages.length > 1 && (
            <PressableScale onPress={() => go(cur - 1)} disabled={cur === 0} hitSlop={8} accessibilityLabel="Previous page">
              <Icon name="back" size={18} color={cur === 0 ? D.line : D.ink} />
            </PressableScale>
          )}
          <Text style={[type.heading, { color: D.ink }]}>{pages.length ? `Page ${cur + 1} of ${pages.length}` : convert ? 'Convert to PDF' : 'Scan'}</Text>
          {pages.length > 1 && (
            <PressableScale onPress={() => go(cur + 1)} disabled={cur === pages.length - 1} hitSlop={8} accessibilityLabel="Next page">
              <Icon name="chevron" size={18} color={cur === pages.length - 1 ? D.line : D.ink} />
            </PressableScale>
          )}
        </View>
        {pages.length > 0 && (
          <PressableScale onPress={discardCurrent} hitSlop={8} accessibilityRole="button" accessibilityLabel="Discard this page" style={styles.hBtn}>
            <Icon name="trash" size={21} color={D.muted} />
          </PressableScale>
        )}
        <PressableScale onPress={addPage} hitSlop={6} accessibilityRole="button" style={styles.addPage}>
          <Text style={[type.button, styles.addPageText]}>ADD PAGE</Text>
        </PressableScale>
      </View>

      <View style={styles.flex}>
        <WV
          ref={web}
          source={{ html: EDITOR_HTML }}
          originWhitelist={['*']}
          onMessage={onMessage}
          style={[styles.flex, { backgroundColor: D.bg }]}
          containerStyle={{ backgroundColor: D.bg }}
          javaScriptEnabled
          allowFileAccess={false}
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          overScrollMode="never"
          androidLayerType="hardware"
          setBuiltInZoomControls={false}
          onShouldStartLoadWithRequest={r => r.url === 'about:blank' || r.url.startsWith('data:')}
        />
        {hint && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.hint} pointerEvents="none">
            <Text style={[type.bodySm, { color: D.ink }]}>{hint}</Text>
          </Animated.View>
        )}
      </View>

      {step === 'filter' && page && (
        <Animated.View entering={FadeIn.duration(220).easing(Easing.out(Easing.cubic))} style={[styles.filters, { backgroundColor: D.bar }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTERS.map(f => {
              const on = page.filter === f.id;
              return (
                <PressableScale key={f.id} onPress={() => update({ filter: f.id })} accessibilityRole="radio" accessibilityState={{ checked: on }} style={styles.filter}>
                  <View style={[styles.thumb, on && styles.thumbOn]}>
                    {thumbs[f.id] ? <Image source={{ uri: thumbs[f.id] }} style={styles.thumbImg} resizeMode="cover" /> : <View style={[styles.thumbImg, { backgroundColor: D.line }]} />}
                    {on && (
                      <View style={styles.tick}>
                        <Icon name="check" size={14} color="#fff" width={3} />
                      </View>
                    )}
                  </View>
                  <Text style={[type.caption, styles.filterText, { color: on ? D.ink : D.muted }]} numberOfLines={2}>
                    {f.label}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}

      <View style={[styles.bottom, { backgroundColor: D.bar, paddingBottom: insets.bottom + 10 }]}>
        {step === 'border' ? (
          <>
            {tool('border', 'Full border', () => setQuad('full'))}
            {tool('detect', 'Detect border', () => setQuad('detect'))}
          </>
        ) : (
          <>
            {tool('crop', 'Border detection', () => goStep('border'))}
            {tool('rotate', 'Rotate', () => update({ rot: (page?.rot ?? 0) + 1 }, true))}
            {tool('distort', 'Distortion', () => update({ distortion: !page?.distortion }, true), page?.distortion ? 'on' : 'off')}
          </>
        )}
        <PressableScale
          onPress={() => (step === 'border' ? goStep('filter') : confirmPage())}
          disabled={!page}
          accessibilityRole="button"
          accessibilityLabel={step === 'border' ? 'Next: filters' : cur < pages.length - 1 ? 'Next page' : 'Done'}
          style={[styles.ok, { backgroundColor: page ? D.accent : D.line }]}>
          <Icon name="check" size={26} color="#03213F" width={3} />
        </PressableScale>
      </View>

      {busy && (
        <View style={[StyleSheet.absoluteFill, styles.busy]}>
          <View style={[styles.busyCard, { backgroundColor: D.bar }]}>
            <ActivityIndicator color={D.accent} />
            <Text style={[type.body, { color: D.ink }]}>{busy}</Text>
          </View>
        </View>
      )}

      <Dialog
        visible={asking}
        theme={theme}
        title={convert ? 'Save as PDF' : 'Scan complete'}
        label={convert ? 'File name' : 'Document name'}
        value={doc?.name ?? (convert ? `Converted ${today()}` : `Scan ${today()}`)}
        check={convert ? undefined : SAVE_AS_PDF}
        okLabel={convert ? 'Save as PDF' : 'Accept'}
        onCancel={() => setAsking(false)}
        onOk={(name, pdf) => save(name, convert || pdf)}
      />
      <ActionSheet title="Add page" actions={sheet} theme={theme} onClose={() => setSheet(null)} />
      <ResultSheet
        file={result?.file ?? null}
        tool={result?.file.mime === 'application/pdf' ? 'scan' : 'scan-doc'}
        theme={theme}
        note={convert ? 'Saved in Scanner → Convert PDFs and in Downloads/Fileora.' : result?.file.mime === 'application/pdf' ? 'Saved in Scanner → Scanned Images and in Downloads/Fileora.' : 'Saved in Scanner → Scanned Images.'}
        openLabel={result?.file.mime === 'application/pdf' ? 'Open PDF' : 'View scan'}
        onClose={closeResult}
        onOpen={f => {
          if (f.mime === 'application/pdf' || !result?.docId) openRecord(f);
          else {
            setResult(null);
            nav.dispatch(StackActions.replace('ScanDoc', { id: result.docId }));
          }
        }}
        onNext={(id, f) => {
          setResult(null);
          keepGoing(id, f);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8, gap: 4 },
  hBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pager: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  addPage: { paddingHorizontal: 10, minHeight: 44, justifyContent: 'center' },
  addPageText: { color: D.ink, letterSpacing: 0.5 },
  hint: { position: 'absolute', left: 16, right: 16, top: 12, backgroundColor: 'rgba(20,26,33,0.92)', borderRadius: 12, padding: 12 },
  filters: { paddingTop: 10 },
  filterRow: { paddingHorizontal: 12, gap: 10 },
  filter: { width: 74, alignItems: 'center', gap: 6 },
  thumb: { width: 58, height: 72, borderRadius: 10, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  thumbOn: { borderColor: D.accent },
  thumbImg: { width: '100%', height: '100%' },
  tick: { position: 'absolute', right: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: D.accent, alignItems: 'center', justifyContent: 'center' },
  filterText: { textAlign: 'center', fontSize: 11.5 },
  bottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, gap: 6 },
  tool: { flex: 1, alignItems: 'center', gap: 4, minHeight: 56, justifyContent: 'center' },
  toolText: { color: D.ink, textAlign: 'center' },
  ok: { width: 58, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  busy: { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  busyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14 },
});
