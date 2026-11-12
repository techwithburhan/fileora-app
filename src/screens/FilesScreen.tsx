/**
 * Files tab: My Storage (Fileora's real file sizes and counts, the phone's free space),
 * Internal storage (Android's file picker), and Fileora's files with filters.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import BlobUtil from 'react-native-blob-util';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import FileRow from '../components/FileRow';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import Segmented from '../components/Segmented';
import { pickFiles } from '../lib/pick';
import { confirmDelete, openRecord } from '../lib/openFile';
import { formatBytes, kindOf, openWithViewer } from '../store/files';
import { FileRec, Source, useStore } from '../store/store';
import { FileFilter, TabParamList } from '../navigation/types';
import { Theme } from '../theme';
import { type } from '../typography';

const FOLDERS: { id: Source[]; key: string; label: string; icon: IconName }[] = [
  { id: ['downloaded'], key: 'downloaded', label: 'Downloads', icon: 'download' },
  { id: ['processed'], key: 'processed', label: 'Processed', icon: 'check' },
  { id: ['scan', 'scan-image'], key: 'scans', label: 'Scans', icon: 'scan' },
];

export default function FilesScreen({ theme }: { theme: Theme }) {
  const { params } = useRoute<RouteProp<TabParamList, 'Files'>>();
  const files = useStore(s => s.files);
  const [filter, setFilter] = useState<FileFilter>(params?.filter ?? 'all');
  const [folder, setFolder] = useState<string | null>(null);
  const [disk, setDisk] = useState<{ free: number; total: number } | null>(null);

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

  const header = (
    <View style={styles.head}>
      <Text style={[type.title, { color: theme.ink }]} accessibilityRole="header">
        Files
      </Text>

      {/* My Storage */}
      <Animated.View entering={FadeInDown.duration(350)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: theme.accent + '1F' }]}>
            <Icon name="storage" size={21} color={theme.dark ? theme.accent : '#0F7F49'} />
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
              accessibilityLabel={`Phone storage ${Math.round((used / disk.total) * 100)}% used`}>
              <View style={[styles.fill, { width: `${(used / disk.total) * 100}%`, backgroundColor: theme.link }]} />
            </View>
            <Text style={[type.caption, { color: theme.muted }]}>
              Phone: {formatBytes(used)} used of {formatBytes(disk.total)} · {formatBytes(disk.free)} free
            </Text>
          </View>
        )}
        <View style={styles.stats}>
          {[
            { label: 'PDFs', v: stats.by.pdf },
            { label: 'Images', v: stats.by.image },
            { label: 'Documents', v: stats.by.document },
          ].map(s => (
            <View key={s.label} style={[styles.stat, { backgroundColor: theme.surface2 }]}>
              <Text style={[type.section, { color: theme.ink }]}>{s.v.n}</Text>
              <Text style={[type.caption, { color: theme.muted }]}>{s.label}</Text>
              <Text style={[type.caption, { color: theme.muted }]}>{formatBytes(s.v.b)}</Text>
            </View>
          ))}
          <View style={[styles.stat, { backgroundColor: theme.surface2 }]}>
            <Text style={[type.section, { color: theme.ink }]}>{stats.processed}</Text>
            <Text style={[type.caption, { color: theme.muted }]}>Processed</Text>
            <Text style={[type.caption, { color: theme.muted }]}>in the app</Text>
          </View>
        </View>
      </Animated.View>

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
                <Icon name="folder" size={24} color={theme.dark ? theme.accent : '#0F7F49'} />
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
      <AppHeader theme={theme} />
      <FlatList<FileRec>
        data={shown}
        keyExtractor={f => f.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={[type.bodySm, styles.empty, { color: theme.muted }]}>{emptyText}</Text>}
        renderItem={({ item }) => <FileRow file={item} theme={theme} onPress={() => openRecord(item)} onMore={() => confirmDelete(item)} />}
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
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  folders: { flexDirection: 'row', gap: 8 },
  folder: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 4 },
  empty: { textAlign: 'center', paddingVertical: 28 },
});
