/** Downloads activity: files downloaded from tools, files opened from Fileora, files processed in the app. */
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import FileRow from '../components/FileRow';
import Icon from '../components/Icon';
import Segmented from '../components/Segmented';
import { activityFiles } from '../store/activity';
import { useStore } from '../store/store';
import { openRecord } from '../lib/openFile';
import { useFileActions } from '../components/FileActions';
import { ActivityTab, RootStackParamList } from '../navigation/types';
import { Theme } from '../theme';
import { type } from '../typography';

const EMPTY: Record<ActivityTab, string> = {
  downloaded: 'Nothing downloaded yet. When a tool gives you a file, it is saved to Downloads/Fileora and listed here.',
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
      <FlatList
        data={data}
        keyExtractor={f => f.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name={tab === 'opened' ? 'clock' : tab === 'downloaded' ? 'download' : 'check'} size={34} color={theme.muted} />
            <Text style={[type.bodySm, styles.emptyText, { color: theme.muted }]}>{EMPTY[tab]}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(300)}>
            <FileRow file={item} theme={theme} when={tab === 'opened' ? 'opened' : 'created'} onPress={() => openRecord(item)} onMore={() => showActions(item)} />
          </Animated.View>
        )}
      />
      {actionSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { paddingHorizontal: 16, paddingTop: 12 },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  emptyText: { textAlign: 'center' },
});
