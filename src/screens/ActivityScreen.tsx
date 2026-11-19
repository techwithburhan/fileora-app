/** Downloads activity: files downloaded from tools, files opened from Fileora, files processed in the app. */
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Text from '../i18n/Text';
import PressableScale from '../components/PressableScale';
import Dialog from '../components/Dialog';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import FileRow from '../components/FileRow';
import Icon from '../components/Icon';
import Segmented from '../components/Segmented';
import { activityFiles } from '../store/activity';
import { store, useStore } from '../store/store';
import { openRecord } from '../lib/openFile';
import { useFileActions } from '../components/FileActions';
import { ActivityTab, RootStackParamList } from '../navigation/types';
import { Theme } from '../theme';
import { type } from '../typography';
import { SAVED_WHERE } from '../store/files';
import Appear from '../components/Appear';
import { tr } from '../i18n/i18n';

/** What Delete all does in each tab: only that tab's files, never the other tabs'. */
const CLEAR: Record<ActivityTab, { title: string; message: string }> = {
  downloaded: {
    title: 'Delete all downloaded files?',
    message: 'Every file in Downloaded moves to the Recycle Bin, where you can restore it. Processed files are not touched. Deleted files also leave the Opened list.',
  },
  opened: {
    title: 'Clear the Opened list?',
    message: 'The Opened list is emptied. No file is deleted: they stay in Downloaded and Processed.',
  },
  processed: {
    title: 'Delete all processed files?',
    message: 'Every file in Processed moves to the Recycle Bin, where you can restore it. Downloaded files are not touched. Deleted files also leave the Opened list.',
  },
};

const EMPTY: Record<ActivityTab, string> = {
  downloaded: 'Nothing downloaded yet. When a tool gives you a file, it is saved to {where} and listed here.',
  opened: 'Nothing opened yet. Files you open from Fileora are listed here.',
  processed: 'Nothing processed yet. Files you merge, number, watermark or convert in the app are listed here.',
};

export default function ActivityScreen({ theme }: { theme: Theme }) {
  const [showActions, actionSheet] = useFileActions(theme);
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Activity'>>();
  const [tab, setTab] = useState<ActivityTab>(params?.tab ?? 'downloaded');
  const files = useStore(s => s.files);
  const lists = useMemo(() => activityFiles(files), [files]);
  const data = lists[tab];
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const clearTab = async () => {
    setAsking(false);
    setBusy(true);
    try {
      if (tab === 'opened') store.clearOpened();
      else await store.trashMany(data.map(f => f.id));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title="Downloads" theme={theme} onBack={() => nav.goBack()} />
      <View style={styles.tabs}>
        <Segmented
          theme={theme}
          value={tab}
          onChange={setTab}
          items={[
            { id: 'downloaded', label: 'Downloaded', count: lists.downloaded.length },
            { id: 'opened', label: 'Opened', count: lists.opened.length },
            { id: 'processed', label: 'Processed', count: lists.processed.length },
          ]}
        />
      </View>
      <View style={styles.bar}>
        <Text style={[type.caption, { color: theme.muted }]}>
          {data.length === 1 ? '1 file' : `${data.length} files`}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={tab === 'opened' ? 'Clear the Opened list' : tr(tab === 'downloaded' ? 'Delete all downloaded files' : 'Delete all processed files')}
          accessibilityState={{ disabled: data.length === 0 || busy }}
          disabled={data.length === 0 || busy}
          onPress={() => setAsking(true)}
          style={[styles.clear, { borderColor: theme.line, backgroundColor: theme.surface, opacity: data.length === 0 || busy ? 0.45 : 1 }]}>
          <Icon name="trash" size={17} color={theme.danger} />
          <Text style={[type.bodySm, styles.clearText, { color: theme.danger }]}>{tab === 'opened' ? 'Clear all' : 'Delete all'}</Text>
        </PressableScale>
      </View>
      <FlatList
        data={data}
        keyExtractor={f => f.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name={tab === 'opened' ? 'clock' : tab === 'downloaded' ? 'download' : 'check'} size={34} color={theme.muted} />
            <Text style={[type.bodySm, styles.emptyText, { color: theme.muted }]}>{tr(EMPTY[tab], { where: tr(SAVED_WHERE) })}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Appear delay={Math.min(index, 8) * 35} duration={300}>
            <FileRow file={item} theme={theme} when={tab === 'opened' ? 'opened' : 'created'} onPress={() => openRecord(item)} onMore={() => showActions(item)} />
          </Appear>
        )}
      />
      {actionSheet}
      <Dialog
        visible={asking}
        theme={theme}
        title={CLEAR[tab].title}
        message={CLEAR[tab].message}
        okLabel={tab === 'opened' ? 'Clear all' : 'Delete all'}
        onCancel={() => setAsking(false)}
        onOk={clearTab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { paddingHorizontal: 16, paddingTop: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  clearText: { fontWeight: '700' },
  list: { padding: 16, paddingTop: 10, gap: 10, paddingBottom: 32 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  emptyText: { textAlign: 'center' },
});
