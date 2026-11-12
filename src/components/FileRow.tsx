import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FileThumb from './FileThumb';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { formatBytes, formatDate } from '../store/files';
import { FileRec } from '../store/store';
import { toolById } from '../data/tools';
import { Theme } from '../theme';
import { type } from '../typography';

const SOURCE: Record<FileRec['source'], string> = { downloaded: 'Downloaded', processed: 'Processed', scan: 'Scanned PDF', 'scan-image': 'Scanned image', convert: 'Converted PDF' };

export default function FileRow({
  file,
  theme,
  onPress,
  onMore,
  moreIcon = 'more',
  when = 'created',
}: {
  file: FileRec;
  theme: Theme;
  onPress: () => void;
  onMore?: () => void;
  moreIcon?: IconName;
  when?: 'created' | 'opened';
}) {
  const tool = file.tool ? toolById(file.tool)?.name : undefined;
  const t = when === 'opened' && file.openedAt ? file.openedAt : file.createdAt;
  const meta = [formatBytes(file.size), file.pages ? `${file.pages} ${file.pages === 1 ? 'page' : 'pages'}` : null, formatDate(t)].filter(Boolean).join(' · ');
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${file.name}, ${meta}. Open`}
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <FileThumb path={file.path} mime={file.mime} name={file.name} theme={theme} size={44} />
      <View style={styles.body}>
        <Text style={[type.heading, { color: theme.ink }]} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
          {meta}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
          {SOURCE[file.source]}
          {tool ? ` · ${tool}` : ''}
        </Text>
      </View>
      {onMore ? (
        <PressableScale onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel={`More actions for ${file.name}`} style={styles.more}>
          <Icon name={moreIcon} size={moreIcon === 'more' ? 22 : 19} color={theme.muted} width={moreIcon === 'more' ? 3 : 2} />
        </PressableScale>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10 },
  body: { flex: 1, gap: 1 },
  more: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
