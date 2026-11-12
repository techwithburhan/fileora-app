/** Recycle Bin: deleted files and scan documents, to restore or delete permanently. */
import React, { useMemo } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import FileThumb from '../components/FileThumb';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { formatBytes, formatDate } from '../store/files';
import { FileRec, ScanDoc, store, useStore } from '../store/store';
import { Theme } from '../theme';
import { type } from '../typography';

type Entry = { key: string; name: string; meta: string; at: number; thumb?: FileRec; doc?: ScanDoc; file?: FileRec };

export default function RecycleBinScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const bin = useStore(s => s.bin);
  const binDocs = useStore(s => s.binDocs);

  const entries = useMemo<Entry[]>(() => {
    const docIds = new Set(binDocs.map(d => d.id));
    const out: Entry[] = binDocs.map(d => {
      const parts = bin.filter(f => f.docId === d.id);
      const pages = parts.filter(f => f.source === 'scan-image');
      return {
        key: 'd' + d.id,
        name: d.name,
        meta: `Scanned document · ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}${d.pdfId ? ' + PDF' : ''} · ${formatBytes(parts.reduce((a, f) => a + f.size, 0))}`,
        at: d.trashedAt ?? 0,
        thumb: pages[0],
        doc: d,
      };
    });
    for (const f of bin) if (!f.docId || !docIds.has(f.docId)) out.push({ key: 'f' + f.id, name: f.name, meta: formatBytes(f.size), at: f.trashedAt ?? 0, thumb: f, file: f });
    return out.sort((a, b) => b.at - a.at);
  }, [bin, binDocs]);
  const total = bin.reduce((a, f) => a + f.size, 0);

  const restore = (e: Entry) => (e.doc ? store.restoreDoc(e.doc.id) : store.restoreFile(e.file!.id)).catch(() => Alert.alert('Couldn’t restore', 'The file is no longer on this phone.'));
  const purge = (e: Entry) =>
    Alert.alert('Delete permanently?', `“${e.name}” will be deleted from this phone. This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => (e.doc ? store.purgeDoc(e.doc.id) : store.purgeFile(e.file!.id)) },
    ]);
  const empty = () =>
    Alert.alert('Empty Recycle Bin?', `${entries.length} ${entries.length === 1 ? 'item' : 'items'} (${formatBytes(total)}) will be deleted permanently. This can’t be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Empty', style: 'destructive', onPress: () => store.emptyBin() },
    ]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title="Recycle Bin" theme={theme} onBack={() => nav.goBack()} />
      <FlatList
        data={entries}
        keyExtractor={e => e.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          entries.length ? (
            <View style={styles.head}>
              <Text style={[type.bodySm, styles.flex, { color: theme.muted }]}>
                {entries.length} {entries.length === 1 ? 'item' : 'items'} · {formatBytes(total)}. Copies in Downloads/Fileora are not affected.
              </Text>
              <PressableScale onPress={empty} accessibilityRole="button" style={[styles.emptyBtn, { borderColor: theme.line }]}>
                <Icon name="trash" size={16} color={theme.danger} />
                <Text style={[type.caption, styles.bold, { color: theme.danger }]}>Empty bin</Text>
              </PressableScale>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
            <Icon name="trash" size={40} color={theme.muted} />
            <Text style={[type.section, { color: theme.ink }]}>Recycle Bin is empty</Text>
            <Text style={[type.bodySm, styles.center, { color: theme.muted }]}>Deleted files and scans wait here until you restore them or delete them permanently.</Text>
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(260)} layout={LinearTransition.duration(220)}>
            <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              {item.thumb ? <FileThumb path={item.thumb.path} mime={item.thumb.mime} name={item.thumb.name} theme={theme} size={44} /> : <Icon name="pages" size={28} color={theme.muted} />}
              <View style={styles.flex}>
                <Text style={[type.heading, { color: theme.ink }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[type.caption, { color: theme.muted }]} numberOfLines={2}>
                  {item.meta} · deleted {formatDate(item.at)}
                </Text>
              </View>
              <PressableScale onPress={() => restore(item)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Restore ${item.name}`} style={styles.icon}>
                <Icon name="restore" size={21} color={theme.link} />
              </PressableScale>
              <PressableScale onPress={() => purge(item)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Delete ${item.name} permanently`} style={styles.icon}>
                <Icon name="trash" size={20} color={theme.danger} />
              </PressableScale>
            </View>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 36 },
  bold: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 10 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 60, paddingHorizontal: 24 },
  center: { textAlign: 'center' },
});
