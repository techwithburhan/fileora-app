/**
 * Side menu with every option the website offers today: all tools and the 7 tool categories,
 * Home, ATS Resume, Blog, Contact us, API Status and the information pages.
 * Slides in from the right; its rows arrive one after another (Reanimated layout animations).
 */
import React, { useEffect, useState } from 'react';
import { BackHandler, Linking, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInRight, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from './Brand';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { useMenu } from './MenuContext';
import { CATEGORIES, TOOL_COUNT } from '../data/tools';
import { DEVELOPER, INFO_PAGES, PAGES, SITE } from '../config';
import { navigationRef, TabParamList } from '../navigation/types';
import { catColor, Theme } from '../theme';
import { trackScreen } from '../analytics';

type Row = { key: string; label: string; icon: IconName; color?: string; count?: number; go: () => void };

function goTab(tab: keyof TabParamList, params?: TabParamList['Tools']) {
  if (navigationRef.isReady()) navigationRef.navigate('Tabs', { screen: tab, params } as never);
}
function goWeb(title: string, url?: string, slugs?: string[]) {
  if (navigationRef.isReady()) navigationRef.navigate('Web', { title, url, slugs });
}

export default function MenuSheet({ theme }: { theme: Theme }) {
  const { visible, close } = useMenu();
  const [mounted, setMounted] = useState(false);
  const p = useSharedValue(0);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelW = Math.min(360, Math.round(width * 0.88));

  useEffect(() => {
    if (visible) {
      setMounted(true);
      p.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });
      trackScreen('menu');
    } else {
      p.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, done => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible, p]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [visible, close]);

  const backdrop = useAnimatedStyle(() => ({ opacity: p.value * 0.55 }));
  const panel = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - p.value) * (panelW + 24) }] }));

  if (!mounted) return null;

  const pick = (fn: () => void) => () => {
    close();
    setTimeout(fn, 140);
  };

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: 'Tools',
      rows: [
        { key: 'all', label: 'All tools', icon: 'grid', count: TOOL_COUNT, go: () => goTab('Tools', { cat: 'all' }) },
        ...CATEGORIES.map(c => ({
          key: c.id,
          label: c.name,
          icon: c.id as IconName,
          color: catColor(c.id, theme),
          count: c.count,
          go: () => goTab('Tools', { cat: c.id }),
        })),
      ],
    },
    {
      title: 'Fileora',
      rows: [
        { key: 'home', label: 'Home', icon: 'home', go: () => goTab('Home') },
        { key: 'resume', label: 'ATS Resume', icon: 'resume', go: () => goTab('Resume') },
        { key: 'blog', label: 'Blog', icon: 'blog', go: () => goTab('Blog') },
        { key: 'contact', label: 'Contact us', icon: 'mail', go: () => goTab('Contact') },
        { key: 'status', label: 'API Status', icon: 'pulse', go: () => goWeb('API Status', PAGES.apiStatus) },
      ],
    },
    {
      title: 'Help & information',
      rows: INFO_PAGES.map(i => ({ key: i.key, label: i.title, icon: 'info' as IconName, go: () => goWeb(i.title, undefined, i.slugs) })),
    },
  ];

  let n = 0;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <PressableScale style={StyleSheet.absoluteFill} scaleTo={1} onPress={close} accessibilityLabel="Close menu" accessibilityRole="button" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.panel, { width: panelW, backgroundColor: theme.bg, paddingTop: insets.top + 8 }, panel]}>
        <View style={styles.head}>
          <Logo height={28} onDark={theme.dark} />
          <PressableScale onPress={close} accessibilityRole="button" accessibilityLabel="Close menu" style={[styles.close, { backgroundColor: theme.surface2 }]}>
            <Icon name="close" size={20} color={theme.ink} />
          </PressableScale>
        </View>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
          {sections.map(sec => (
            <View key={sec.title} style={styles.section}>
              <Text style={[styles.secTitle, { color: theme.muted }]} accessibilityRole="header">
                {sec.title.toUpperCase()}
              </Text>
              {sec.rows.map(r => (
                <Animated.View key={r.key} entering={FadeInRight.delay(60 + n++ * 22).duration(320)}>
                  <PressableScale
                    scaleTo={0.98}
                    onPress={pick(r.go)}
                    accessibilityRole="button"
                    accessibilityLabel={r.count ? `${r.label}, ${r.count} tools` : r.label}
                    style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                    <View style={[styles.rowIcon, { backgroundColor: (r.color ?? theme.accent) + '1F' }]}>
                      <Icon name={r.icon} size={19} color={r.color ?? theme.accent} />
                    </View>
                    <Text style={[styles.rowLabel, { color: theme.ink }]} numberOfLines={1}>
                      {r.label}
                    </Text>
                    {r.count ? <Text style={[styles.count, { color: theme.muted, backgroundColor: theme.surface2 }]}>{r.count}</Text> : null}
                    <Icon name="chevron" size={18} color={theme.muted} />
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          ))}
          <PressableScale
            scaleTo={0.98}
            onPress={() => Linking.openURL(SITE)}
            accessibilityRole="link"
            style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={[styles.rowIcon, { backgroundColor: theme.surface2 }]}>
              <Icon name="external" size={19} color={theme.ink2} />
            </View>
            <Text style={[styles.rowLabel, { color: theme.ink }]}>Open fileora.in</Text>
          </PressableScale>
          <Text style={[styles.foot, { color: theme.muted }]}>
            Fileora app 0.2 · {Platform.OS === 'android' ? 'Android' : Platform.OS}
          </Text>
          <Text style={[styles.foot, { color: theme.muted }]} onPress={() => Linking.openURL(DEVELOPER.url)} accessibilityRole="link">
            Made by <Text style={{ color: theme.link }}>{DEVELOPER.name}</Text>
          </Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#020B17' },
  panel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  close: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 14, gap: 6 },
  section: { gap: 6, marginTop: 10 },
  secTitle: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, marginLeft: 4, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 52 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  count: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  foot: { fontSize: 12.5, textAlign: 'center', marginTop: 10 },
});
