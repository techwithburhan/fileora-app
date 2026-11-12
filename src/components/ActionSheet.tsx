/** Bottom sheet with a short list of actions (⋮ menus, picking a source). */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { Theme } from '../theme';
import { type } from '../typography';

export type SheetAction = { key: string; label: string; sub?: string; icon: IconName; danger?: boolean; onPress: () => void };

export default function ActionSheet({ title, actions, theme, onClose }: { title?: string; actions: SheetAction[] | null; theme: Theme; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  if (!actions) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))}
        style={[styles.sheet, { backgroundColor: theme.bg, paddingBottom: insets.bottom + 14 }]}>
        <View style={[styles.grab, { backgroundColor: theme.line }]} />
        {title ? (
          <Text style={[type.heading, styles.title, { color: theme.ink }]} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {actions.map(a => (
          <PressableScale
            key={a.key}
            scaleTo={0.985}
            onPress={() => {
              onClose();
              a.onPress();
            }}
            accessibilityRole="button"
            style={styles.row}>
            <View style={[styles.icon, { backgroundColor: a.danger ? theme.danger + '1A' : theme.surface2 }]}>
              <Icon name={a.icon} size={20} color={a.danger ? theme.danger : theme.ink2} />
            </View>
            <View style={styles.flex}>
              <Text style={[type.body, { color: a.danger ? theme.danger : theme.ink }]}>{a.label}</Text>
              {a.sub ? <Text style={[type.caption, { color: theme.muted }]}>{a.sub}</Text> : null}
            </View>
          </PressableScale>
        ))}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,11,23,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 12, paddingTop: 8 },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  title: { paddingHorizontal: 8, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 8, paddingVertical: 10, minHeight: 56, borderRadius: 14 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
