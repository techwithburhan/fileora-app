import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StackHeader from '../components/StackHeader';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { ToolChip } from '../components/ToolCard';
import { categoryById, isApiTool, isAvailable, isHidden, toolById, toolState, TOOLS } from '../data/tools';
import { maintenanceMessage, soonMessage, uiConfig, useRemote } from '../remote/remote';
import { toolUrl } from '../config';
import { useToolInfo } from '../lib/toolInfo';
import { featureMessage, screenState } from '../navigation/nav';
import { isNative } from '../data/nativeTools';
import { RootStackParamList } from '../navigation/types';
import { trackTool } from '../analytics';
import { catColor, Theme } from '../theme';
import { type } from '../typography';
import AdBanner from '../ads/AdBanner';
import Appear from '../components/Appear';

export default function ToolScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Tool'>>();
  useRemote(s => s.config); // re-render when App Center settings change
  const tool = toolById(params.id);
  // App Center → Manage → Tool pages: extra sections, the same switches as on the website
  const ui = uiConfig().tool;
  const info = useToolInfo(params.id, ui.after_content || ui.faq);
  const [openQ, setOpenQ] = useState<number | null>(null);
  if (!tool) return null;
  const cat = categoryById(tool.cat);
  const c = catColor(tool.cat, theme);
  const related = TOOLS.filter(t => t.cat === tool.cat && t.id !== tool.id && !isHidden(t)).slice(0, 8);
  const where =
    tool.exec === 'server'
      ? { icon: 'cloud' as IconName, title: 'Runs on the Fileora server', text: 'Needs internet. The file goes over HTTPS to the Fileora processing server and is deleted after download, or automatically within 1 hour.' }
      : { icon: 'phone' as IconName, title: 'Runs on your phone, also offline', text: 'The file is processed on this phone by the app itself and is never uploaded.' };

  const native = isNative(tool.id);
  const available = isAvailable(tool);
  const state = toolState(tool);
  const open = () => {
    if (!available) return;
    trackTool(tool.id);
    if (tool.id === 'scan') {
      if (screenState('scanner') === 'on' || screenState('scanner') === 'hidden') nav.navigate('Tabs', { screen: 'Scanner' });
      else featureMessage('scanner', tool.name); // Scanner is "coming soon" or disabled in App Center
    }
    else if (native) nav.navigate('Process', { tool: tool.id });
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title={cat?.name ?? 'Tool'} theme={theme} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {ui.breadcrumbs && (
          <View style={styles.crumbs} accessibilityRole="header" accessibilityLabel={`Home, ${cat?.name ?? 'Tools'}, ${tool.name}`}>
            <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Home' })} hitSlop={6}>
              <Text style={[type.caption, { color: theme.link }]}>Home</Text>
            </Pressable>
            <Icon name="chevron" size={12} color={theme.muted} />
            <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Tools', params: { cat: tool.cat } })} hitSlop={6}>
              <Text style={[type.caption, { color: theme.link }]}>{cat?.name ?? 'Tools'}</Text>
            </Pressable>
            <Icon name="chevron" size={12} color={theme.muted} />
            <Text style={[type.caption, styles.flex, { color: theme.muted }]} numberOfLines={1}>
              {tool.name}
            </Text>
          </View>
        )}
        <Appear duration={320} rise={false} style={[styles.bigIcon, { backgroundColor: c + '1F' }]}>
          <Icon name={tool.cat as IconName} size={40} color={c} />
        </Appear>
        <Appear text delay={80} duration={450} style={[styles.name, { color: theme.ink }]} accessibilityRole="header">
          {tool.name}
        </Appear>
        <Appear text delay={140} duration={450} style={[styles.desc, { color: theme.ink2 }]}>
          {tool.desc}
        </Appear>
        <Appear delay={200} duration={450} style={[styles.where, { backgroundColor: theme.surface, borderColor: theme.line }, !available && isApiTool(tool) && styles.dim]}>
          <Icon name={where.icon} size={22} color={tool.exec === 'browser' ? theme.accent : theme.link} />
          <View style={styles.flex}>
            <Text style={[styles.whereTitle, { color: theme.ink }]}>{where.title}</Text>
            <Text style={[styles.whereText, { color: theme.muted }]}>{where.text}</Text>
          </View>
        </Appear>
        {!available && (
          <Appear delay={230} duration={400}
            accessibilityRole="alert"
            style={[styles.where, { backgroundColor: theme.warnBg, borderColor: theme.warnLine }]}>
            <Icon name="info" size={22} color={theme.warnInk} />
            <View style={styles.flex}>
              <Text style={[styles.whereTitle, { color: theme.ink }]}>{state === 'soon' ? 'Coming soon' : 'Temporarily unavailable'}</Text>
              <Text style={[styles.whereText, { color: theme.ink2 }]}>{state === 'soon' ? soonMessage() : maintenanceMessage()}</Text>
            </View>
          </Appear>
        )}
        <Appear delay={260} duration={450}>
          <PressableScale
            onPress={open}
            disabled={!available}
            accessibilityRole="button"
            accessibilityState={{ disabled: !available }}
            style={[styles.open, { backgroundColor: available ? theme.accent : theme.surface2 }]}>
            <Text style={[styles.openText, { color: available ? theme.onAccent : theme.muted }]}>{available ? `Open ${tool.name}` : 'Temporarily unavailable'}</Text>
            {available && <Icon name="chevron" size={20} color={theme.onAccent} width={2.4} />}
          </PressableScale>
        </Appear>
        {ui.website_link && (
          <PressableScale onPress={() => Linking.openURL(toolUrl(tool.slug)).catch(() => {})} accessibilityRole="link" style={styles.webLink}>
            <Icon name="external" size={16} color={theme.link} />
            <Text style={[type.button, { color: theme.link }]}>Open on fileora.in</Text>
          </PressableScale>
        )}
        {ui.after_content && info && info.content.length > 0 && (
          <View style={styles.about}>
            {info.content.map((b, i) =>
              b.t === 'h' ? (
                <Text key={i} style={[type.section, styles.aboutH, { color: theme.ink }]} accessibilityRole="header">
                  {b.text}
                </Text>
              ) : b.t === 'li' ? (
                <View key={i} style={styles.li}>
                  <Text style={[type.body, { color: theme.accentInk }]}>•</Text>
                  <Text style={[type.body, styles.flex, { color: theme.ink2 }]}>{b.text}</Text>
                </View>
              ) : (
                <Text key={i} style={[type.body, { color: theme.ink2 }]}>
                  {b.text}
                </Text>
              ),
            )}
          </View>
        )}
        {ui.faq && info && info.faq.length > 0 && (
          <View style={styles.about}>
            <Text style={[type.section, styles.aboutH, { color: theme.ink }]} accessibilityRole="header">
              Questions & answers
            </Text>
            {info.faq.map((x, i) => (
              <View key={i} style={[styles.qa, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <Pressable onPress={() => setOpenQ(openQ === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: openQ === i }} style={styles.qRow}>
                  <Text style={[type.heading, styles.flex, { color: theme.ink }]}>{x.q}</Text>
                  <Icon name={openQ === i ? 'up' : 'down'} size={18} color={theme.ink2} />
                </Pressable>
                {openQ === i && <Text style={[type.body, styles.answer, { color: theme.ink2 }]}>{x.a}</Text>}
              </View>
            ))}
          </View>
        )}
        {ui.more_tools && related.length > 0 && (
          <>
            <Text style={[styles.secTitle, { color: theme.ink }]}>More {cat?.name ?? 'tools'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel} style={styles.carouselOuter}>
              {related.map(t => (
                <ToolChip key={t.id} tool={t} theme={theme} onPress={() => nav.navigate('Tool', { id: t.id })} />
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
      {/* App Center → Ads: anchored banner under a divider, below the page's content */}
      <AdBanner placement="tool_banner" theme={theme} style={{ paddingBottom: insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  bigIcon: { width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  name: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  desc: { fontSize: 16, lineHeight: 24 },
  where: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, alignItems: 'flex-start' },
  dim: { opacity: 0.6 },
  whereTitle: { fontSize: 15, fontWeight: '800' },
  whereText: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  open: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, borderRadius: 16 },
  openText: { fontSize: 16.5, fontWeight: '800' },
  secTitle: { fontSize: 18, fontWeight: '800', marginTop: 12 },
  carouselOuter: { marginHorizontal: -20 },
  carousel: { paddingHorizontal: 20, gap: 10 },
  crumbs: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: -4 },
  webLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
  about: { gap: 10, marginTop: 6 },
  aboutH: { marginTop: 6 },
  li: { flexDirection: 'row', gap: 8 },
  qa: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 52 },
  answer: { paddingHorizontal: 14, paddingBottom: 14 },
});
