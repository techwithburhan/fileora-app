/**
 * Images shared to Fileora (Gallery → Share → Fileora): already loaded, pick a tool and go.
 * Image tools open with the images already chosen; "Scan to PDF" opens the scanner editor.
 */
import React, { useMemo } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { RouteProp, StackActions, useNavigation, useRoute } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { toolUrl } from '../config';
import { Tool, TOOLS, toolById } from '../data/tools';
import { formatBytes } from '../store/files';
import { store } from '../store/store';
import { RootStackParamList } from '../navigation/types';
import { catColor, Theme } from '../theme';
import { type } from '../typography';

const FIRST = ['imgcompress', 'imgresize', 'imgkb', 'imgconvert', 'imgcrop', 'jpg2pdf', 'examphoto', 'passport'];

export default function SharedScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Shared'>>();
  const files = params.files;
  const tools = useMemo(() => {
    const list: Tool[] = [];
    for (const id of FIRST) {
      const t = toolById(id);
      if (t) list.push(t);
    }
    for (const t of TOOLS) if ((t.cat === 'image' || t.id === 'jpg2pdf') && !list.includes(t)) list.push(t);
    return list;
  }, []);
  const total = files.reduce((a, f) => a + (f.size || 0), 0);

  const openTool = (t: Tool) => {
    store.logOpen(t.id);
    nav.dispatch(StackActions.push('Web', { url: toolUrl(t.slug), title: t.name, tool: t.id, inject: files.map(f => ({ path: f.path, name: f.name, mime: f.mime })) }));
  };
  const scan = () => {
    store.logOpen('scan');
    nav.dispatch(StackActions.push('ScanEditor', { mode: 'convert', pages: files.map(f => ({ path: f.path, mime: f.mime })) }));
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title="Shared to Fileora" theme={theme} onBack={() => nav.goBack()} />
      <FlatList
        data={tools}
        keyExtractor={t => t.id}
        numColumns={2}
        columnWrapperStyle={styles.cols}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.head}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previews}>
              {files.map((f, i) => (
                <Animated.View key={f.key} entering={FadeIn.delay(i * 40).duration(260)}>
                  <Image source={{ uri: `file://${f.path}` }} style={[styles.preview, { backgroundColor: theme.surface2, borderColor: theme.line }]} resizeMode="cover" accessibilityLabel={f.name} />
                </Animated.View>
              ))}
            </ScrollView>
            <Text style={[type.bodySm, { color: theme.muted }]}>
              {files.length} {files.length === 1 ? 'image' : 'images'} · {formatBytes(total)} · ready. Choose what to do:
            </Text>
            <PressableScale onPress={scan} accessibilityRole="button" style={[styles.scan, { backgroundColor: theme.accent }]}>
              <Icon name="scan" size={24} color={theme.onAccent} width={2.4} />
              <View style={styles.flex}>
                <Text style={[type.heading, { color: theme.onAccent }]}>Scan to PDF</Text>
                <Text style={[type.caption, { color: theme.onAccent }]}>Straighten, crop and clean up the page, then save as PDF</Text>
              </View>
              <Icon name="chevron" size={20} color={theme.onAccent} />
            </PressableScale>
            <Text style={[type.section, { color: theme.ink }]}>Image tools</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const c = catColor(item.cat, theme);
          return (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 25).duration(260)} style={styles.cell}>
              <PressableScale onPress={() => openTool(item)} accessibilityRole="button" accessibilityLabel={item.name} style={[styles.tool, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <View style={[styles.toolIcon, { backgroundColor: c + '1F' }]}>
                  <Icon name={item.cat === 'image' ? 'image' : 'pdf'} size={20} color={c} />
                </View>
                <Text style={[type.caption, styles.flex, { color: theme.ink }]} numberOfLines={2}>
                  {item.name}
                </Text>
              </PressableScale>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  head: { gap: 12, marginBottom: 4 },
  previews: { gap: 8 },
  preview: { width: 92, height: 120, borderRadius: 12, borderWidth: 1 },
  scan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  cols: { gap: 10 },
  cell: { flex: 1 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10, minHeight: 58 },
  toolIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
