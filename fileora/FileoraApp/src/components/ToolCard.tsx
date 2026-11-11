import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { Tool } from '../data/tools';
import { catColor, Theme } from '../theme';

export function ExecBadge({ tool, theme }: { tool: Tool; theme: Theme }) {
  const device = tool.exec === 'browser';
  return (
    <View style={styles.badgeRow}>
      <Icon name={device ? 'phone' : 'cloud'} size={14} color={device ? theme.accent : theme.link} />
      <Text style={[styles.where, { color: theme.muted }]}>{device ? 'On your phone' : tool.exec === 'hybrid' ? 'Phone or server' : 'Fileora server'}</Text>
    </View>
  );
}

/** Grid card (2 columns). */
export function ToolCard({ tool, theme, onPress, index = 0 }: { tool: Tool; theme: Theme; onPress: () => void; index?: number }) {
  const c = catColor(tool.cat, theme);
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 45).duration(380)} style={styles.cell}>
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${tool.name}. ${tool.desc}`}
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={[styles.icon, { backgroundColor: c + '1F' }]}>
          <Icon name={tool.cat as IconName} size={22} color={c} />
        </View>
        <Text style={[styles.name, { color: theme.ink }]} numberOfLines={2}>
          {tool.name}
        </Text>
        <Text style={[styles.desc, { color: theme.muted }]} numberOfLines={2}>
          {tool.desc}
        </Text>
        <ExecBadge tool={tool} theme={theme} />
      </PressableScale>
    </Animated.View>
  );
}

/** Compact card for horizontal carousels. */
export function ToolChip({ tool, theme, onPress }: { tool: Tool; theme: Theme; onPress: () => void }) {
  const c = catColor(tool.cat, theme);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tool.name}
      style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View style={[styles.icon, { backgroundColor: c + '1F' }]}>
        <Icon name={tool.cat as IconName} size={22} color={c} />
      </View>
      <Text style={[styles.chipName, { color: theme.ink }]} numberOfLines={2}>
        {tool.name}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1 },
  card: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14, gap: 6, minHeight: 168 },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  desc: { fontSize: 13, lineHeight: 18 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 'auto' },
  where: { fontSize: 11.5, fontWeight: '700' },
  chip: { width: 128, borderWidth: 1, borderRadius: 18, padding: 12, gap: 8, minHeight: 112 },
  chipName: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
});
