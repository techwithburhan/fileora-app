/** A scanned document: its pages in a grid (open, reorder, discard), add pages, Save as PDF. */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import ActionSheet, { SheetAction } from '../components/ActionSheet';
import Dialog from '../components/Dialog';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import ResultSheet from '../components/ResultSheet';
import { confirmDiscard, openRecord, shareRecord } from '../lib/openFile';
import { useKeepGoing } from '../lib/keepGoing';
import { imagesToPdf } from '../lib/pdf';
import { saveResult } from '../lib/output';
import { FileRec, store, useStore } from '../store/store';
import { RootStackParamList } from '../navigation/types';
import { Theme } from '../theme';
import { type } from '../typography';

export default function ScanDocScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ScanDoc'>>();
  const doc = useStore(s => s.docs.find(d => d.id === params.id));
  const files = useStore(s => s.files);
  const pages = useMemo(() => (doc?.pageIds ?? []).map(id => files.find(f => f.id === id)).filter((f): f is FileRec => !!f), [doc, files]);
  const pdf = doc?.pdfId ? files.find(f => f.id === doc.pdfId) : undefined;
  const [sheet, setSheet] = useState<{ title?: string; actions: SheetAction[] } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FileRec | null>(null);
  const keepGoing = useKeepGoing();

  useEffect(() => {
    if (doc && !doc.openedAt) store.updateDoc(doc.id, { openedAt: Date.now() });
  }, [doc]);
  useEffect(() => {
    if (!doc && !result) nav.goBack(); // the whole document was deleted
  }, [doc, nav, result]);
  if (!doc) return null;

  const move = (i: number, d: -1 | 1) => {
    const ids = [...doc.pageIds];
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    store.updateDoc(doc.id, { pageIds: ids });
  };
  const pageMenu = (f: FileRec, i: number) =>
    setSheet({
      title: `Page ${i + 1}`,
      actions: [
        { key: 'open', label: 'Open', icon: 'external', onPress: () => openRecord(f) },
        ...(i > 0 ? [{ key: 'up', label: 'Move earlier', icon: 'back' as IconName, onPress: () => move(i, -1) }] : []),
        ...(i < pages.length - 1 ? [{ key: 'down', label: 'Move later', icon: 'chevron' as IconName, onPress: () => move(i, 1) }] : []),
        { key: 'del', label: 'Discard', sub: 'Moves to the Recycle Bin', icon: 'trash', danger: true, onPress: () => confirmDiscard(() => store.trashFile(f.id)) },
      ],
    });
  const addPages = () =>
    setSheet({
      title: 'Add pages',
      actions: [
        { key: 'cam', label: 'Camera', icon: 'camera', onPress: () => nav.navigate('ScanEditor', { mode: 'images', source: 'camera', docId: doc.id }) },
        { key: 'gal', label: 'Gallery', icon: 'image', onPress: () => nav.navigate('ScanEditor', { mode: 'images', source: 'gallery', docId: doc.id }) },
      ],
    });
  const makePdf = async () => {
    setBusy(true);
    try {
      const r = await imagesToPdf(pages.map(p => ({ path: p.path, mime: p.mime })));
      const rec = await saveResult({ name: `${doc.name}.pdf`, base64: r.base64, mime: 'application/pdf', source: 'scan', tool: 'scan', bytesIn: pages.reduce((a, p) => a + p.size, 0), pages: r.pages });
      if (doc.pdfId) await store.trashFile(doc.pdfId);
      store.updateDoc(doc.id, { pdfId: rec.id });
      setResult(rec);
    } catch (e) {
      Alert.alert('The PDF couldn’t be made', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title={doc.name} theme={theme} onBack={() => nav.goBack()} />
      <FlatList
        data={pages}
        keyExtractor={f => f.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.head}>
            <View style={styles.titleRow}>
              <Text style={[type.caption, styles.flex, { color: theme.muted }]}>
                {pages.length} {pages.length === 1 ? 'page' : 'pages'}
                {pdf ? ' · PDF saved' : ''}
              </Text>
              <PressableScale onPress={() => setRenaming(true)} hitSlop={8} accessibilityRole="button" style={styles.rename}>
                <Icon name="pencil" size={16} color={theme.link} />
                <Text style={[type.caption, { color: theme.link }]}>Rename</Text>
              </PressableScale>
            </View>
            <View style={styles.actions}>
              <PressableScale onPress={makePdf} disabled={busy || !pages.length} accessibilityRole="button" style={[styles.btn, styles.flex, { backgroundColor: theme.accent }]}>
                {busy ? <ActivityIndicator color={theme.onAccent} /> : <Text style={[type.button, { color: theme.onAccent }]}>{pdf ? 'Update PDF' : 'Save as PDF'}</Text>}
              </PressableScale>
              {pdf && (
                <PressableScale onPress={() => openRecord(pdf)} accessibilityRole="button" style={[styles.btn, styles.flex, { backgroundColor: theme.surface2 }]}>
                  <Text style={[type.button, { color: theme.ink }]}>Open PDF</Text>
                </PressableScale>
              )}
              {pdf && (
                <PressableScale onPress={() => shareRecord(pdf)} accessibilityRole="button" accessibilityLabel="Share PDF" style={[styles.btn, styles.square, { backgroundColor: theme.surface2 }]}>
                  <Icon name="share" size={20} color={theme.ink} />
                </PressableScale>
              )}
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeIn.duration(240)} layout={LinearTransition.duration(220)} style={styles.cell}>
            <PressableScale scaleTo={0.97} onPress={() => openRecord(item)} accessibilityRole="button" accessibilityLabel={`Page ${index + 1}. Open`}>
              <Image source={{ uri: `file://${item.path}` }} style={[styles.page, { backgroundColor: theme.surface2, borderColor: theme.line }]} resizeMode="cover" />
            </PressableScale>
            <View style={styles.cap}>
              <Text style={[type.caption, styles.flex, { color: theme.ink2 }]}>Page {index + 1}</Text>
              <PressableScale onPress={() => pageMenu(item, index)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`More actions for page ${index + 1}`}>
                <Icon name="more" size={20} color={theme.muted} width={3} />
              </PressableScale>
            </View>
          </Animated.View>
        )}
      />
      <PressableScale onPress={addPages} accessibilityRole="button" accessibilityLabel="Add pages" style={[styles.fab, { backgroundColor: theme.accent }]}>
        <Icon name="scan" size={26} color="#03213F" width={2.4} />
      </PressableScale>
      <ActionSheet title={sheet?.title} actions={sheet?.actions ?? null} theme={theme} onClose={() => setSheet(null)} />
      <Dialog
        visible={renaming}
        title="Rename"
        label="Document name"
        value={doc.name}
        okLabel="Save"
        theme={theme}
        onCancel={() => setRenaming(false)}
        onOk={name => {
          store.updateDoc(doc.id, { name });
          setRenaming(false);
        }}
      />
      <ResultSheet
        file={result}
        tool="scan"
        theme={theme}
        note="Saved with this document and in Downloads/Fileora."
        openLabel="Open PDF"
        onClose={() => setResult(null)}
        onOpen={openRecord}
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
  list: { padding: 16, paddingBottom: 110, gap: 14 },
  head: { gap: 12, marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  rename: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  square: { width: 48 },
  row: { gap: 12 },
  cell: { width: '31%', gap: 6 },
  page: { width: '100%', aspectRatio: 0.72, borderRadius: 10, borderWidth: 1 },
  cap: { flexDirection: 'row', alignItems: 'center' },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
});
