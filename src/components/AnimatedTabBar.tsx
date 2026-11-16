/**
 * Bottom navigation with a pill that slides to the active item and icons that spring up (Reanimated).
 * The items come from App Center → Navigation (built-in defaults: Home, Tools, Scanner, Files,
 * Alerts, Settings). Items for app tabs switch tabs; tools, categories and web pages open on top.
 * Alerts shows the number of unread notifications.
 */
import React, { useEffect } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Icon, { IconName } from './Icon';
import { navIcon, openNavItem, TAB_OF, useNav } from '../navigation/nav';
import { Theme } from '../theme';
import { useUnread } from '../remote/inbox';

const SMOOTH = { duration: 260, easing: Easing.out(Easing.cubic) };

function TabItem({
  focused,
  label,
  icon,
  badge,
  count,
  dim,
  theme,
  onPress,
}: {
  focused: boolean;
  label: string;
  icon: IconName;
  badge?: string;
  /** unread notifications (Alerts) */
  count?: number;
  dim?: boolean;
  theme: Theme;
  onPress: () => void;
}) {
  const f = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    f.value = withTiming(focused ? 1 : 0, SMOOTH);
  }, [focused, f]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -1.5 * f.value }, { scale: 1 + 0.06 * f.value }] }));
  const color = focused ? theme.accent : theme.muted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused, disabled: dim }}
      accessibilityLabel={badge ? `${label}, ${badge}` : count ? `${label}, ${count} unread` : label}
      style={[styles.item, dim && styles.dim]}>
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={22} color={color} width={focused ? 2.3 : 2} />
        {badge ? (
          <Text style={[styles.badge, { backgroundColor: theme.warnBg, color: theme.warnInk, borderColor: theme.warnLine }]} maxFontSizeMultiplier={1.1}>
            {badge}
          </Text>
        ) : count ? (
          <View style={[styles.count, { borderColor: theme.header }]}>
            <Text style={styles.countText} maxFontSizeMultiplier={1.1}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        ) : null}
      </Animated.View>
      <Text style={[styles.label, focused && styles.labelOn, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AnimatedTabBar({ state, navigation, insets, theme }: BottomTabBarProps & { theme: Theme }) {
  const items = useNav().bar;
  const unread = useUnread();
  const w = useSharedValue(0);
  const x = useSharedValue(0);
  const count = Math.max(1, items.length);
  const current = state.routes[state.index]?.name;
  // the pill sits on the item for the current tab (none if that tab isn't in the bar)
  const active = items.findIndex(i => i.open === 'screen' && TAB_OF[i.value] === current);
  const visible = useSharedValue(active >= 0 ? 1 : 0);

  useEffect(() => {
    visible.value = withTiming(active >= 0 ? 1 : 0, SMOOTH);
    if (w.value && active >= 0) x.value = withTiming(active * (w.value / count), SMOOTH);
  }, [active, count, w, x, visible]);

  const onLayout = (e: LayoutChangeEvent) => {
    w.value = e.nativeEvent.layout.width;
    x.value = Math.max(0, active) * (w.value / count);
  };
  const pill = useAnimatedStyle(() => ({ width: w.value / count, opacity: visible.value, transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.header, borderTopColor: theme.line }]}>
      <View style={styles.row} onLayout={onLayout} accessibilityRole="tablist">
        <Animated.View style={[styles.pillWrap, pill]} pointerEvents="none">
          <View style={[styles.pill, { backgroundColor: theme.accent + (theme.dark ? '29' : '1F') }]} />
        </Animated.View>
        {items.map((it, i) => {
          const tab = it.open === 'screen' ? TAB_OF[it.value] : undefined;
          const focused = i === active;
          return (
            <TabItem
              key={`${it.id}-${i}`}
              focused={focused}
              label={it.label}
              icon={navIcon(it)}
              badge={it.status === 'soon' ? 'Soon' : undefined}
              count={tab === 'Alerts' && it.status === 'on' ? unread : undefined}
              dim={it.status === 'off'}
              theme={theme}
              onPress={() => {
                if (it.status !== 'on' || !tab) {
                  openNavItem(it); // message, or a tool / category / page on top
                  return;
                }
                const route = state.routes.find(r => r.name === tab);
                if (!route) return;
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
  dim: { opacity: 0.45 },
  label: { fontSize: 11, fontWeight: '500' },
  labelOn: { fontWeight: '800' },
  count: { position: 'absolute', top: -5, left: 13, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#D92D20', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFFFFF' },
  countText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
  badge: { position: 'absolute', top: -6, left: 14, fontSize: 8.5, fontWeight: '800', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
