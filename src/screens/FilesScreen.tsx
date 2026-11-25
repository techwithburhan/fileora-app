/**
 * Files tab: My Storage (Fileora's real file sizes and counts, the phone's free space),
 * Internal storage (Android's file picker), Cloud Storage, Recycle Bin, and Fileora's files with filters.
 * 1.2.4: the storage counts sit in a 2 × 2 grid (no more broken words), the filters wrap instead of
 * running off the screen, and "Delete all" moves the files shown to the Recycle Bin after a question.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import CountUp from '../components/CountUp';
import Dialog from '../components/Dialog';
import Alert from '../i18n/Alert';
import Text from '../i18n/Text';

import BlobUtil from 'react-native-blob-util';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useHeaderScroll } from '../components/headerScroll';
import FileRow from '../components/FileRow';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import Segmented from '../components/Segmented';
import { pickFiles } from '../lib/pick';
import { openRecord } from '../lib/openFile';
import { useFileActions } from '../components/FileActions';
import { formatBytes, kindOf, openWithViewer } from '../store/files';
import { FileRec, Source, store, useStore } from '../store/store';
import { FileFilter, TabParamList } from '../navigation/types';
import { catColor, Theme } from '../theme';
import { type } from '../typography';
import Appear from '../components/Appear';
import { tr } from '../i18n/i18n';

const FOLDERS: { id: Source[]; key: string; label: string; icon: IconName }[] = [
  { id: ['downloaded'], key: 'downloaded', label: 'Downloads', icon: 'download' },
  { id: ['processed'], key: 'processed', label: 'Processed', icon: 'check' },
  { id: ['scan', 'scan-image', 'convert'], key: 'scans', label: 'Scans', icon: 'scan' },
];

export default function FilesScreen({ theme }: { theme: Theme }) {
  useHeaderScroll();
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<TabParamList, 'Files'>>();
  const files = useStore(s => s.files);
  const bin = useStore(s => s.bin);
  const clouds = useStore(s => s.clouds);
  const [showActions, actionSheet] = useFileActions(theme);
  const [filter, setFilter] = useState<FileFilter>(params?.filter ?? 'all');
  const [folder, setFolder] = useState<string | null>(null);
  const [disk, setDisk] = useState<{ free: number; total: number } | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  // the Recycle Bin card gives a little bounce when files land in it
  const reduced = useReducedMotion();
  const binPop = useSharedValue(1);
  const binStyle = useAnimatedStyle(() => ({ transform: [{ scale: binPop.value }] }));

  useFocusEffect(
    useCallback(() => {
      BlobUtil.fs
        .df()
        .then(d => {
          const free = Number(d.internal_free ?? d.free);
          const total = Number(d.internal_total ?? d.total);
          if (free > 0 && total > 0) setDisk({ free, total });
        })
        .catch(() => {});
    }, []),
  );

  const stats = useMemo(() => {
    const by = { pdf: { n: 0, b: 0 }, image: { n: 0, b: 0 }, document: { n: 0, b: 0 }, other: { n: 0, b: 0 } };
    let bytes = 0;
    for (const f of files) {
      const k = kindOf(f.mime, f.name);
      by[k].n++;
      by[k].b += f.size;
      bytes += f.size;
    }
    return { by, bytes, processed: files.filter(f => f.source === 'processed').length };
  }, [files]);

  const shown = useMemo(() => {
    if (filter === 'folders') {
      const fo = FOLDERS.find(x => x.key === folder);
      return fo ? files.filter(f => fo.id.includes(f.source)) : [];
    }
    if (filter === 'all') return files;
    return files.filter(f => kindOf(f.mime, f.name) === filter);
  }, [files, filter, folder]);

  const browse = async () => {
    try {
      const [f] = await pickFiles('any', false);
      if (f) await openWithViewer(f.path, f.mime);
    } catch (e) {
      Alert.alert('Can’t open this file', e instanceof Error ? e.message : 'No app on this phone can open this file type.');
    }
  };

  const used = disk ? disk.total - disk.free : 0;

  /** Delete all: exactly the files in the list below (this filter / folder) go to the Recycle Bin. */
  const deleteShown = async () => {
    setAsking(false);
    setBusy(true);
    try {
      await store.trashMany(shown.map(f => f.id));
      if (!reduced) binPop.value = withSequence(withTiming(1.07, { duration: 140 }), withSpring(1, { damping: 7, stiffness: 180 }));
    } catch (e) {
      Alert.alert('Couldn’t delete the files', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const shownBytes = shown.reduce((a, f) => a + f.size, 0);
  const tiles: { key: string; n: number; label: string; sub: string; icon: IconName; color: string }[] = [
    { key: 'pdf', n: stats.by.pdf.n, label: 'PDFs', sub: formatBytes(stats.by.pdf.b), icon: 'pdf', color: catColor('pdf', theme) },
    { key: 'image', n: stats.by.image.n, label: 'Images', sub: formatBytes(stats.by.image.b), icon: 'image', color: catColor('image', theme) },
    { key: 'document', n: stats.by.document.n, label: 'Documents', sub: formatBytes(stats.by.document.b), icon: 'file', color: catColor('converter', theme) },
    { key: 'processed', n: stats.processed, label: 'Processed', sub: 'in the app', icon: 'check', color: theme.accentInk },
  ];

  const header = (
    <View style={styles.head}>
      <Text style={[type.title, { color: theme.ink }]} accessibilityRole="header">
        Files
      </Text>

      {/* My Storage */}
      <Appear duration={350} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: theme.accent + '1F' }]}>
            <Icon name="storage" size={21} color={theme.accentInk} />
          </View>
          <View style={styles.flex}>
            <Text style={[type.heading, { color: theme.ink }]}>My Storage</Text>
            <Text style={[type.caption, { color: theme.muted }]}>
              Fileora files: {formatBytes(stats.bytes)} · {files.length} {files.length === 1 ? 'file' : 'files'}
            </Text>
          </View>
        </View>
        {disk && (
          <View style={styles.diskWrap}>
            <View
              style={[styles.track, { backgroundColor: theme.surface2 }]}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={tr('Phone storage {pct}% used', { pct: Math.round((used / disk.total) * 100) })}>
              <View style={[styles.fill, { width: `${(used / disk.total) * 100}%`, backgroundColor: theme.link }]} />
            </View>
            <Text style={[type.caption, { color: theme.muted }]}>
              Phone: {formatBytes(used)} used of {formatBytes(disk.total)} · {formatBytes(disk.free)} free
            </Text>
          </View>
        )}
        <View style={styles.statGrid}>
          {[tiles.slice(0, 2), tiles.slice(2)].map((row, r) => (
            <View key={r} style={styles.statRow}>
              {row.map((t, i) => (
                <Appear key={t.key} delay={120 + (r * 2 + i) * 60} duration={320} style={[styles.stat, { backgroundColor: theme.surface2 }]}>
                  <View style={styles.statTop}>
                    <View style={[styles.statIcon, { backgroundColor: t.color + '1F' }]}>
                      <Icon name={t.icon} size={18} color={t.color} />
                    </View>
                    <CountUp value={t.n} style={[type.section, styles.flex, { color: theme.ink }]} />
                  </View>
                  <Text style={[type.caption, { color: theme.ink2 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {t.label}
                  </Text>
                  <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {t.sub}
                  </Text>
                </Appear>
              ))}
            </View>
          ))}
        </View>
      </Appear>

      {/* Cloud Storage + Recycle Bin */}
      <View style={styles.pair}>
        <PressableScale onPress={() => nav.navigate('Cloud')} accessibilityRole="button" style={[styles.card, styles.half, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={[styles.icon, { backgroundColor: theme.link + '1A' }]}>
            <Icon name="cloud" size={21} color={theme.link} />
          </View>
          <Text style={[type.heading, { color: theme.ink }]}>Cloud Storage</Text>
          <Text style={[type.caption, { color: theme.muted }]}>
            {Object.keys(clouds).length ? `${Object.keys(clouds).length} connected` : 'Drive, JioCloud, OneDrive'}
          </Text>
        </PressableScale>
        <Animated.View style={[styles.half, binStyle]}>
        <PressableScale onPress={() => nav.navigate('RecycleBin')} accessibilityRole="button" style={[styles.card, styles.fill1, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={[styles.icon, { backgroundColor: theme.danger + '14' }]}>
            <Icon name="trash" size={20} color={theme.danger} />
          </View>
          <Text style={[type.heading, { color: theme.ink }]}>Recycle Bin</Text>
          <Text style={[type.caption, { color: theme.muted }]}>{bin.length ? `${bin.length} ${bin.length === 1 ? 'file' : 'files'} · ${formatBytes(bin.reduce((a, f) => a + f.size, 0))}` : 'Empty'}</Text>
        </PressableScale>
        </Animated.View>
      </View>

      {/* Internal storage */}
      <PressableScale onPress={browse} accessibilityRole="button" style={[styles.card, styles.row, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={[styles.icon, { backgroundColor: theme.surface2 }]}>
          <Icon name="phone" size={21} color={theme.ink2} />
        </View>
        <View style={styles.flex}>
          <Text style={[type.heading, { color: theme.ink }]}>Internal storage</Text>
          <Text style={[type.caption, { color: theme.muted }]}>Browse your phone and open a file</Text>
        </View>
        <Icon name="chevron" size={18} color={theme.muted} />
      </PressableScale>

      <Segmented
        theme={theme}
        wrap
        value={filter}
        onChange={v => {
          setFilter(v);
          setFolder(v === 'folders' ? 'downloaded' : null);
        }}
        items={[
          { id: 'all', label: 'All Files' },
          { id: 'pdf', label: 'PDF' },
          { id: 'image', label: 'Images' },
          { id: 'document', label: 'Documents' },
          { id: 'folders', label: 'Folders' },
        ]}
      />

      {shown.length > 0 && (
        <View style={styles.listBar}>
          <Text style={[type.caption, styles.flex, { color: theme.muted }]} numberOfLines={1}>
            {shown.length === 1 ? tr('1 file') : tr('{n} files', { n: shown.length })} · {formatBytes(shownBytes)}
          </Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={tr('Delete all files shown here')}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => setAsking(true)}
            style={[styles.clear, { borderColor: theme.line, backgroundColor: theme.surface, opacity: busy ? 0.45 : 1 }]}>
            <Icon name="trash" size={16} color={theme.danger} />
            <Text style={[type.caption, styles.clearText, { color: theme.danger }]}>Delete all</Text>
          </PressableScale>
        </View>
      )}

      {filter === 'folders' && (
        <View style={styles.folders}>
          {FOLDERS.map(fo => {
            const list = files.filter(f => fo.id.includes(f.source));
            const on = folder === fo.key;
            return (
              <PressableScale
                key={fo.key}
                onPress={() => setFolder(fo.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.folder, { backgroundColor: on ? theme.accent + '1F' : theme.surface, borderColor: on ? theme.accent : theme.line }]}>
                <Icon name="folder" size={24} color={theme.accentInk} />
                <Text style={[type.heading, { color: theme.ink }]} numberOfLines={1} adjustsFontSizeToFit>
                  {fo.label}
                </Text>
                <Text style={[type.caption, { color: theme.muted }]}>
                  {list.length} · {formatBytes(list.reduce((a, f) => a + f.size, 0))}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      )}
    </View>
  );

  const emptyText =
    filter === 'folders' ? 'This folder is empty.' : files.length ? 'No files of this type.' : 'No files yet. Results from tools and scans are kept here.';

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <FlatList<FileRec>
        data={shown}
        keyExtractor={f => f.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={[type.bodySm, styles.empty, { color: theme.muted }]}>{emptyText}</Text>}
        renderItem={({ item }) => <FileRow file={item} theme={theme} onPress={() => openRecord(item)} onMore={() => showActions(item)} />}
      />
      {actionSheet}
      <Dialog
        visible={asking}
        theme={theme}
        title="Delete all files shown here?"
        message={
          shown.length === 1
            ? tr('1 file moves to the Recycle Bin, where you can restore it. Other files on your phone are not touched.')
            : tr('{n} files move to the Recycle Bin, where you can restore them. Other files on your phone are not touched.', { n: shown.length })
        }
        okLabel="Delete all"
        onCancel={() => setAsking(false)}
        onOk={deleteShown}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  head: { gap: 14, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  diskWrap: { gap: 6 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 5 },
  statGrid: { gap: 8 },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, gap: 4, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, minHeight: 68 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 36 },
  clearText: { fontWeight: '800' },
  fill1: { flex: 1 },
  folders: { flexDirection: 'row', gap: 8 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, gap: 4 },
  folder: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 },
  empty: { textAlign: 'center', paddingVertical: 28 },
});
