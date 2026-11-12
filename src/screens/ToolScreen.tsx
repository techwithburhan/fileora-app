import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { ToolChip } from '../components/ToolCard';
import { categoryById, toolById, TOOLS } from '../data/tools';
import { toolUrl } from '../config';
import { isNative } from '../data/nativeTools';
import { store } from '../store/store';
import { RootStackParamList } from '../navigation/types';
import { trackTool } from '../analytics';
import { catColor, Theme } from '../theme';

export default function ToolScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Tool'>>();
  const tool = toolById(params.id);
  if (!tool) return null;
  const cat = categoryById(tool.cat);
  const c = catColor(tool.cat, theme);
  const related = TOOLS.filter(t => t.cat === tool.cat && t.id !== tool.id).slice(0, 8);
  const where =
    tool.exec === 'browser'
      ? { icon: 'phone' as IconName, title: 'Runs on your phone', text: 'The file is processed on this phone and is never uploaded.' }
      : tool.exec === 'hybrid'
        ? { icon: 'cloud' as IconName, title: 'Phone or Fileora server', text: 'Runs on your phone when it can; otherwise the file goes over HTTPS to the Fileora server and is deleted after the task.' }
        : { icon: 'cloud' as IconName, title: 'Runs on the Fileora server', text: 'The file goes over HTTPS to the Fileora server and is deleted after download, or automatically within 1 hour.' };

  const native = isNative(tool.id);
  const open = () => {
    trackTool(tool.id);
    if (tool.id === 'scan') nav.navigate('Tabs', { screen: 'Scanner' });
    else if (native) nav.navigate('Process', { tool: tool.id });
    else {
      store.logOpen(tool.id);
      nav.navigate('Web', { url: toolUrl(tool.slug), title: tool.name, tool: tool.id });
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title={cat?.name ?? 'Tool'} theme={theme} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={ZoomIn.duration(420).springify().damping(14)} style={[styles.bigIcon, { backgroundColor: c + '1F' }]}>
          <Icon name={tool.cat as IconName} size={40} color={c} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(80).duration(450)} style={[styles.name, { color: theme.ink }]} accessibilityRole="header">
          {tool.name}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(140).duration(450)} style={[styles.desc, { color: theme.ink2 }]}>
          {tool.desc}
        </Animated.Text>
        <Animated.View entering={FadeInDown.delay(200).duration(450)} style={[styles.where, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Icon name={where.icon} size={22} color={tool.exec === 'browser' ? theme.accent : theme.link} />
          <View style={styles.flex}>
            <Text style={[styles.whereTitle, { color: theme.ink }]}>{where.title}</Text>
            <Text style={[styles.whereText, { color: theme.muted }]}>{where.text}</Text>
          </View>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(260).duration(450)}>
          <PressableScale onPress={open} accessibilityRole="button" style={[styles.open, { backgroundColor: theme.accent }]}>
            <Text style={[styles.openText, { color: theme.onAccent }]}>Open {tool.name}</Text>
            <Icon name="chevron" size={20} color={theme.onAccent} width={2.4} />
          </PressableScale>
        </Animated.View>
        {related.length > 0 && (
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
  whereTitle: { fontSize: 15, fontWeight: '800' },
  whereText: { fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  open: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54, borderRadius: 16 },
  openText: { fontSize: 16.5, fontWeight: '800' },
  secTitle: { fontSize: 18, fontWeight: '800', marginTop: 12 },
  carouselOuter: { marginHorizontal: -20 },
  carousel: { paddingHorizontal: 20, gap: 10 },
});
