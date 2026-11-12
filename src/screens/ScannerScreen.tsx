/**
 * Scanner tab with two independent tabs on one page:
 *  - Scanned Images: Camera / Gallery → scan documents (pages + optional PDF)
 *  - Convert PDFs: PDFs or images → straighten, crop, filter → Save as PDF
 * Each tab has its own list, its own + button and its own "Clear all".
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import ActionSheet, { SheetAction } from '../components/ActionSheet';
import Dialog from '../components/Dialog';
import FileRow from '../components/FileRow';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { confirmClearAll, confirmDelete, confirmDeleteDoc, openRecord, shareRecord } from '../lib/openFile';
import { formatDate } from '../store/files';
import { FileRec, ScanDoc, store, useStore } from '../store/store';
import { Theme } from '../theme';
import { type } from '../typography';

type Tab = 'images' | 'convert';
type Sort = 'new' | 'old' | 'name';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'new', label: 'Newest first' },
  { id: 'old', label: 'Oldest first' },
  { id: 'name', label: 'Name (A–Z)' },
];

function sortBy<T extends { createdAt: number; name: string }>(list: T[], s: Sort) {
  const out = [...list];
  if (s === 'new') out.sort((a, b) => b.createdAt - a.createdAt);
  else if (s === 'old') out.sort((a, b) => a.createdAt - b.createdAt);
  else out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export default function ScannerScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const files = useStore(s => s.files);
  const docsAll = useStore(s => s.docs);
  const [tab, setTab] = useState<Tab>('images');
  const [sort, setSort] = useState<Record<Tab, Sort>>({ images: 'new', convert: 'new' });
  const [fab, setFab] = useState(false);
  const [sheet, setSheet] = useState<{ title?: string; actions: SheetAction[] } | null>(null);
  const [renaming, setRenaming] = useState<ScanDoc | null>(null);

  const docs = useMemo(() => sortBy(docsAll, sort.images), [docsAll, sort.images]);
  const pdfs = useMemo(() => sortBy(files.filter(f => f.source === 'convert'), sort.convert), [files, sort.convert]);
  const byId = useMemo(() => new Map(files.map(f => [f.id, f])), [files]);

  const start = (source: 'camera' | 'gallery' | 'pdf' | 'images') => {
    setFab(false);
    store.logOpen('scan');
    nav.navigate('ScanEditor', { mode: tab, source });
  };

  const docMenu = (d: ScanDoc) => {
    const pdf = d.pdfId ? byId.get(d.pdfId) : undefined;
    setSheet({
      title: d.name,
      actions: [
        { key: 'open', label: 'Open', icon: 'pages', onPress: () => nav.navigate('ScanDoc', { id: d.id }) },
        ...(pdf
          ? [
              { key: 'pdf', label: 'Open PDF', icon: 'pdf' as IconName, onPress: () => openRecord(pdf) },
              { key: 'share', label: 'Share PDF', icon: 'share' as IconName, onPress: () => shareRecord(pdf) },
            ]
          : []),
        { key: 'rename', label: 'Rename', icon: 'pencil', onPress: () => setRenaming(d) },
        { key: 'del', label: 'Delete', sub: 'Moves to the Recycle Bin', icon: 'trash', danger: true, onPress: () => confirmDeleteDoc(d) },
      ],
    });
  };
  const pdfMenu = (f: FileRec) =>
    setSheet({
      title: f.name,
      actions: [
        { key: 'open', label: 'Open', icon: 'external', onPress: () => openRecord(f) },
        { key: 'share', label: 'Share', icon: 'share', onPress: () => shareRecord(f) },
        { key: 'del', label: 'Delete', sub: 'Moves to the Recycle Bin', icon: 'trash', danger: true, onPress: () => confirmDelete(f, 'PDF') },
      ],
    });

  const clearAll = () => {
    if (tab === 'images')
      confirmClearAll('scanned documents', docs.length, async () => {
        for (const d of docs) await store.trashDoc(d.id);
      });
    else
      confirmClearAll('converted PDFs', pdfs.length, async () => {
        for (const f of pdfs) await store.trashFile(f.id);
      });
  };

  const count = tab === 'images' ? docs.length : pdfs.length;
  const tabCard = (id: Tab, label: string, icon: IconName, n: number) => {
    const on = tab === id;
    return (
      <PressableScale
        key={id}
        scaleTo={0.98}
        onPress={() => {
          setTab(id);
          setFab(false);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label}, ${n}`}
        style={[styles.tab, { backgroundColor: on ? theme.accent + '14' : theme.surface, borderColor: on ? theme.accent : theme.line }]}>
        <View style={[styles.tabIcon, { backgroundColor: on ? theme.accent + '22' : theme.surface2 }]}>
          <Icon name={icon} size={22} color={on ? (theme.accentInk) : theme.ink2} />
        </View>
        <Text style={[type.heading, { color: on ? theme.ink : theme.ink2 }]}>{label}</Text>
        {n > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.link }]}>
            <Text style={[type.caption, styles.badgeText]}>{n}</Text>
          </View>
        )}
      </PressableScale>
    );
  };

  const empty = (
    <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
      <EmptyArt theme={theme} />
      <Text style={[type.section, { color: theme.ink }]}>No files found</Text>
      <Text style={[type.bodySm, styles.centerText, { color: theme.muted }]}>
        {tab === 'images' ? 'Tap the + button to scan with the camera or pick photos from the gallery.' : 'Tap the + button to add a PDF or images and turn them into a clean PDF.'}
      </Text>
    </Animated.View>
  );

  const header = (
    <View style={styles.head}>
      <View>
        <Text style={[type.title, { color: theme.ink }]} accessibilityRole="header">
          Scanner
        </Text>
        <Text style={[type.bodySm, { color: theme.muted }]}>Scans and conversions are made and kept on this phone.</Text>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {tabCard('images', 'Scanned Images', 'image', docs.length)}
        {tabCard('convert', 'Convert PDFs', 'pdf', pdfs.length)}
      </View>
      {count > 0 && (
        <View style={styles.tools}>
          <PressableScale onPress={clearAll} accessibilityRole="button" style={[styles.clear, { borderColor: theme.line }]}>
            <Icon name="trash" size={16} color={theme.danger} />
            <Text style={[type.caption, styles.clearText, { color: theme.danger }]}>Clear all</Text>
          </PressableScale>
          <View style={styles.flex} />
          <PressableScale
            onPress={() =>
              setSheet({
                title: 'Sort',
                actions: SORTS.map(s => ({ key: s.id, label: s.label + (sort[tab] === s.id ? '  ✓' : ''), icon: 'sort' as IconName, onPress: () => setSort(o => ({ ...o, [tab]: s.id })) })),
              })
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Sort: ${SORTS.find(s => s.id === sort[tab])?.label}`}
            style={styles.sortBtn}>
            <Icon name="sort" size={22} color={theme.ink2} />
          </PressableScale>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <AppHeader theme={theme} />
      {tab === 'images' ? (
        <FlatList<ScanDoc>
          key="images"
          data={docs}
          keyExtractor={d => d.id}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(260)} layout={LinearTransition.duration(220)}>
              <DocRow doc={item} first={byId.get(item.pageIds[0])} hasPdf={!!item.pdfId} theme={theme} onPress={() => nav.navigate('ScanDoc', { id: item.id })} onMore={() => docMenu(item)} />
            </Animated.View>
          )}
        />
      ) : (
        <FlatList<FileRec>
          key="convert"
          data={pdfs}
          keyExtractor={f => f.id}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(260)} layout={LinearTransition.duration(220)}>
              <FileRow file={item} theme={theme} onPress={() => openRecord(item)} onMore={() => pdfMenu(item)} />
            </Animated.View>
          )}
        />
      )}

      {fab && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={styles.dim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFab(false)} accessibilityLabel="Close" />
        </Animated.View>
      )}
      {fab && (
        <View style={styles.pills} pointerEvents="box-none">
          {(tab === 'images'
            ? [
                { id: 'camera', label: 'Camera', icon: 'camera' },
                { id: 'gallery', label: 'Gallery', icon: 'image' },
              ]
            : [
                { id: 'pdf', label: 'PDF', icon: 'pdf' },
                { id: 'images', label: 'Images', icon: 'image' },
              ]
          ).map((o, i) => (
            <Animated.View key={o.id} entering={FadeInDown.delay(i * 40).duration(220).easing(Easing.out(Easing.cubic))} exiting={FadeOut.duration(120)}>
              <PressableScale onPress={() => start(o.id as 'camera')} accessibilityRole="button" style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <Icon name={o.icon as IconName} size={21} color={theme.ink} />
                <Text style={[type.button, { color: theme.ink }]}>{o.label}</Text>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      )}
      <PressableScale
        onPress={() => setFab(o => !o)}
        accessibilityRole="button"
        accessibilityLabel={fab ? 'Close' : tab === 'images' ? 'New scan' : 'Convert to PDF'}
        style={[styles.fab, { backgroundColor: fab ? theme.surface2 : theme.accent }]}>
        <Icon name={fab ? 'close' : 'plus'} size={28} color={fab ? theme.ink : '#03213F'} width={2.6} />
      </PressableScale>

      <ActionSheet title={sheet?.title} actions={sheet?.actions ?? null} theme={theme} onClose={() => setSheet(null)} />
      <Dialog
        visible={!!renaming}
        title="Rename"
        label="Document name"
        value={renaming?.name}
        okLabel="Save"
        theme={theme}
        onCancel={() => setRenaming(null)}
        onOk={name => {
          if (renaming) store.updateDoc(renaming.id, { name });
          setRenaming(null);
        }}
      />
    </View>
  );
}

function DocRow({ doc, first, hasPdf, theme, onPress, onMore }: { doc: ScanDoc; first?: FileRec; hasPdf: boolean; theme: Theme; onPress: () => void; onMore: () => void }) {
  const n = doc.pageIds.length;
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${doc.name}, ${n} ${n === 1 ? 'page' : 'pages'}${hasPdf ? ', PDF saved' : ''}`}
      style={[styles.doc, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View style={[styles.docThumb, { backgroundColor: theme.surface2 }]}>
        {first ? <Image source={{ uri: `file://${first.path}` }} style={styles.docImg} resizeMode="cover" /> : <Icon name="image" size={22} color={theme.muted} />}
        {!doc.openedAt && <View style={[styles.newDot, { backgroundColor: theme.link, borderColor: theme.surface }]} />}
      </View>
      <View style={styles.flex}>
        <Text style={[type.heading, { color: theme.ink }]} numberOfLines={1}>
          {doc.name}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]}>
          {n} {n === 1 ? 'Element' : 'Elements'} · {formatDate(doc.createdAt)}
        </Text>
        {hasPdf && (
          <View style={[styles.chip, { backgroundColor: theme.accent + '1F' }]}>
            <Text style={[type.caption, { color: theme.accentInk }]}>PDF saved</Text>
          </View>
        )}
      </View>
      <PressableScale onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel={`More actions for ${doc.name}`} style={styles.more}>
        <Icon name="more" size={22} color={theme.muted} width={3} />
      </PressableScale>
    </PressableScale>
  );
}

/** Empty-state drawing: a page, a magnifier and a few sparkles, in the brand colours. */
function EmptyArt({ theme }: { theme: Theme }) {
  const ink = theme.dark ? '#5D6B7C' : '#C6D0DC';
  return (
    <Svg width={170} height={120} viewBox="0 0 170 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M18 104h134" stroke={ink} strokeWidth={2} strokeLinecap="round" />
      <Rect x={52} y={14} width={58} height={78} rx={8} fill={theme.surface} stroke={ink} strokeWidth={2} />
      <Path d="M62 32h30M62 42h38M62 52h24M62 62h34" stroke={ink} strokeWidth={3} strokeLinecap="round" />
      <Rect x={60} y={70} width={22} height={14} rx={3} fill="#17AF64" opacity={0.85} />
      <Circle cx={112} cy={72} r={16} fill="none" stroke="#006DFC" strokeWidth={4} />
      <Path d="M124 84l14 14" stroke="#006DFC" strokeWidth={5} strokeLinecap="round" />
      <Path d="M30 30l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM142 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#F5B700" />
      <Circle cx={146} cy={52} r={3} fill={ink} />
      <Circle cx={26} cy={70} r={4} fill="none" stroke={ink} strokeWidth={2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 10, paddingBottom: 120 },
  head: { gap: 14, marginBottom: 2 },
  tabs: { flexDirection: 'row', gap: 10 },
  tab: { flex: 1, borderWidth: 1.5, borderRadius: 18, padding: 12, gap: 8, minHeight: 104 },
  tabIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, right: 10, minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontWeight: '700' },
  tools: { flexDirection: 'row', alignItems: 'center' },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 36 },
  clearText: { fontWeight: '700' },
  sortBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 24 },
  centerText: { textAlign: 'center' },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10 },
  docThumb: { width: 48, height: 60, borderRadius: 8, overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  docImg: { width: 48, height: 60, borderRadius: 8 },
  newDot: { position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, marginTop: 3 },
  more: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,11,23,0.35)' },
  pills: { position: 'absolute', right: 18, bottom: 92, alignItems: 'flex-end', gap: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, minHeight: 50, elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  fab: { position: 'absolute', right: 18, bottom: 18, width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
});
