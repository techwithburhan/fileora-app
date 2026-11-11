import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { Theme } from '../theme';

export default function StackHeader({
  title,
  theme,
  onBack,
  action,
}: {
  title: string;
  theme: Theme;
  onBack: () => void;
  action?: { icon: IconName; label: string; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8, backgroundColor: theme.header, borderBottomColor: theme.line }]}>
      <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={[styles.btn, { backgroundColor: theme.surface2 }]}>
        <Icon name="back" size={21} color={theme.ink} />
      </PressableScale>
      <Text style={[styles.title, { color: theme.ink }]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <PressableScale onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} style={[styles.btn, { backgroundColor: theme.surface2 }]}>
          <Icon name={action.icon} size={19} color={theme.ink} />
        </PressableScale>
      ) : (
        <View style={styles.btn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  btn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'center' },
});
