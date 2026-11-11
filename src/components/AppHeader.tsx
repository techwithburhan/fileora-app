/**
 * Top bar: the Fileora logo, search and the menu button. With a scroll position (scrollY) the bar
 * gets its line and shadow only after the content scrolls under it.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Logo } from './Brand';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { useMenu } from './MenuContext';
import { Theme } from '../theme';

export default function AppHeader({ theme, scrollY, search = true }: { theme: Theme; scrollY?: SharedValue<number>; search?: boolean }) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const menu = useMenu();
  const shade = useAnimatedStyle(() => {
    const t = scrollY ? interpolate(scrollY.value, [0, 24], [0, 1], 'clamp') : 1;
    return { borderBottomColor: theme.dark ? `rgba(30,58,95,${t})` : `rgba(220,228,238,${t})`, shadowOpacity: 0.08 * t, elevation: 4 * t };
  });
  return (
    <Animated.View style={[styles.bar, { paddingTop: insets.top + 8, backgroundColor: theme.header }, shade]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Fileora home"
        onPress={() => nav.navigate('Tabs', { screen: 'Home' })}
        hitSlop={8}>
        <Logo height={32} onDark={theme.dark} />
      </PressableScale>
      <View style={styles.actions}>
        {search && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Search tools"
            onPress={() => nav.navigate('Tabs', { screen: 'Tools', params: { focus: Date.now() } })}
            style={[styles.btn, { backgroundColor: theme.surface2 }]}>
            <Icon name="search" size={21} color={theme.ink} />
          </PressableScale>
        )}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          onPress={menu.open}
          style={[styles.btn, { backgroundColor: theme.surface2 }]}>
          <Icon name="menu" size={21} color={theme.ink} />
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: '#04336B',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    zIndex: 5,
  },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
