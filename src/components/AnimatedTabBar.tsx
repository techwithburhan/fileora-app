/**
 * Bottom navigation (Home, Tools, Scanner, Files, Resume, Settings) with a pill that slides to the active tab
 * and icons that spring up (Reanimated).
 */
import React, { useEffect } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const SMOOTH = { duration: 260, easing: Easing.out(Easing.cubic) };
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Icon, { IconName } from './Icon';
import { Theme } from '../theme';

const META: Record<string, { label: string; icon: IconName }> = {
  Home: { label: 'Home', icon: 'home' },
  Tools: { label: 'Tools', icon: 'grid' },
  Scanner: { label: 'Scanner', icon: 'scan' },
  Files: { label: 'Files', icon: 'folder' },
  Resume: { label: 'Resume', icon: 'resume' },
  Settings: { label: 'Settings', icon: 'settings' },
};

function TabItem({ focused, label, icon, theme, onPress }: { focused: boolean; label: string; icon: IconName; theme: Theme; onPress: () => void }) {
  const f = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    f.value = withTiming(focused ? 1 : 0, SMOOTH);
  }, [focused, f]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -1.5 * f.value }, { scale: 1 + 0.06 * f.value }] }));
  const color = focused ? theme.accent : theme.muted;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} style={styles.item}>
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={22} color={color} width={focused ? 2.3 : 2} />
      </Animated.View>
      <Text style={[styles.label, focused && styles.labelOn, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AnimatedTabBar({ state, navigation, insets, theme }: BottomTabBarProps & { theme: Theme }) {
  const w = useSharedValue(0);
  const x = useSharedValue(0);
  const count = state.routes.length;

  useEffect(() => {
    if (w.value) x.value = withTiming(state.index * (w.value / count), SMOOTH);
  }, [state.index, count, w, x]);

  const onLayout = (e: LayoutChangeEvent) => {
    w.value = e.nativeEvent.layout.width;
    x.value = state.index * (w.value / count);
  };
  const pill = useAnimatedStyle(() => ({ width: w.value / count, transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.header, borderTopColor: theme.line }]}>
      <View style={styles.row} onLayout={onLayout} accessibilityRole="tablist">
        <Animated.View style={[styles.pillWrap, pill]} pointerEvents="none">
          <View style={[styles.pill, { backgroundColor: theme.accent + (theme.dark ? '29' : '1F') }]} />
        </Animated.View>
        {state.routes.map((route, i) => {
          const m = META[route.name];
          const focused = state.index === i;
          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={m.label}
              icon={m.icon}
              theme={theme}
              onPress={() => {
                const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !ev.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  row: { flexDirection: 'row' },
  pillWrap: { position: 'absolute', top: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  pill: { width: '86%', maxWidth: 64, height: 52, borderRadius: 16 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 56 },
  label: { fontSize: 11, fontWeight: '500' },
  labelOn: { fontWeight: '800' },
});
