/**
 * Files shared to Fileora (Gallery / File Manager / Google Files → Share → Fileora): already loaded,
 * pick a tool and go. Image tools open with the images already chosen; "Scan to PDF" opens the
 * scanner editor. 1.2.4: PDFs list the PDF tools (with the PDFs already chosen), and Word, Excel or
 * PowerPoint files mixed with others get their converter; each tool gets only the files it takes.
 */
import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../i18n/Text';

import { RouteProp, StackActions, useNavigation, useRoute } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import FileThumb from '../components/FileThumb';
import { isAvailable, Tool, TOOLS, toolById } from '../data/tools';
import { formatBytes } from '../store/files';
import { store } from '../store/store';
import { RootStackParamList } from '../navigation/types';
import { Picked } from '../lib/pick';
import { CONVERTER, pdfTools, sharedKind, SharedKind } from '../lib/sharedKinds';
import { catColor, Theme } from '../theme';
import { type } from '../typography';
import Appear from '../components/Appear';
import { tr } from '../i18n/i18n';

const FIRST = ['imgcompress', 'imgresize', 'imgkb', 'imgconvert', 'imgcrop', 'jpg2pdf', 'examphoto', 'passport'];
const GROUP_TITLE: Record<SharedKind, string> = { image: 'Image tools', pdf: 'PDF tools', word: 'Word to PDF', excel: 'Excel to PDF', ppt: 'PowerPoint to PDF', other: '' };
const GROUP_ICON: Record<SharedKind, IconName> = { image: 'image', pdf: 'pdf', word: 'word', excel: 'converter', ppt: 'converter', other: 'file' };

type Group = { kind: SharedKind; tools: Tool[]; files: Picked[] };

export default function SharedScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'Shared'>>();
  const files = params.files;
  const byKind = useMemo(() => {
    const m = new Map<SharedKind, Picked[]>();
    for (const f of files) {
      const k = sharedKind(f.mime, f.name);
      m.set(k, [...(m.get(k) ?? []), f]);
    }
    return m;
  }, [files]);
  const onlyImages = byKind.size === 1 && byKind.has('image');
  const groups = useMemo(() => {
    const out: Group[] = [];
    const imgs = byKind.get('image');
    if (imgs) {
      const list: Tool[] = [];
      for (const id of FIRST) {
        const t = toolById(id);
        if (t) list.push(t);
      }
      for (const t of TOOLS) if ((t.cat === 'image' || t.id === 'jpg2pdf') && !list.includes(t)) list.push(t);
      out.push({ kind: 'image', tools: list.filter(t => isAvailable(t)), files: imgs });
    }
    const pdfs = byKind.get('pdf');
    if (pdfs) {
      const list = pdfTools(pdfs.length)
        .map(id => toolById(id))
        .filter((t): t is Tool => !!t && isAvailable(t));
      out.push({ kind: 'pdf', tools: list, files: pdfs });
    }
    for (const k of ['word', 'excel', 'ppt'] as SharedKind[]) {
      const fs = byKind.get(k);
      const t = fs ? toolById(CONVERTER[k] ?? '') : undefined;
      if (fs) out.push({ kind: k, tools: t && isAvailable(t) ? [t] : [], files: fs });
    }
    return out;
  }, [byKind]);
  const total = files.reduce((a, f) => a + (f.size || 0), 0);

  const openTool = (t: Tool, fs: Picked[]) => {
    nav.dispatch(StackActions.push('Process', { tool: t.id, files: fs.map(f => ({ path: f.path, name: f.name, mime: f.mime, size: f.size })) }));
  };
  const scan = () => {
    store.logOpen('scan');
    nav.dispatch(StackActions.push('ScanEditor', { mode: 'convert', pages: files.map(f => ({ path: f.path, mime: f.mime })) }));
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title="Shared to Fileora" theme={theme} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previews}>
            {files.map((f, i) => (
              <Appear key={f.key} delay={i * 40} duration={260} rise={false}>
                {sharedKind(f.mime, f.name) === 'image' ? (
                  <Image source={{ uri: `file://${f.path}` }} style={[styles.preview, { backgroundColor: theme.surface2, borderColor: theme.line }]} resizeMode="cover" accessibilityLabel={f.name} />
                ) : (
                  <View style={[styles.preview, styles.docPreview, { backgroundColor: theme.surface2, borderColor: theme.line }]} accessible accessibilityLabel={f.name}>
                    <FileThumb path={f.path} mime={f.mime} name={f.name} theme={theme} size={64} />
                    <Text style={[type.caption, styles.docName, { color: theme.ink2 }]} numberOfLines={2} noTranslate>
                      {f.name}
                    </Text>
                  </View>
                )}
              </Appear>
            ))}
          </ScrollView>
          <Text style={[type.bodySm, { color: theme.muted }]}>
            {onlyImages
              ? `${files.length} ${files.length === 1 ? 'image' : 'images'} · ${formatBytes(total)} · ready. Choose what to do:`
              : tr('{n} files · {size} · ready. Choose what to do:', { n: files.length, size: formatBytes(total) })}
          </Text>
          {onlyImages && (
            <PressableScale onPress={scan} accessibilityRole="button" style={[styles.scan, { backgroundColor: theme.accent }]}>
              <Icon name="scan" size={24} color={theme.onAccent} width={2.4} />
              <View style={styles.flex}>
                <Text style={[type.heading, { color: theme.onAccent }]}>Scan to PDF</Text>
                <Text style={[type.caption, { color: theme.onAccent }]}>Straighten, crop and clean up the page, then save as PDF</Text>
              </View>
              <Icon name="chevron" size={20} color={theme.onAccent} />
            </PressableScale>
          )}
        </View>

        {groups.map(g => (
          <View key={g.kind} style={styles.group}>
            <Text style={[type.section, { color: theme.ink }]}>{GROUP_TITLE[g.kind]}</Text>
            {!onlyImages && (
              <Text style={[type.caption, { color: theme.muted }]}>
                {tr('{n} files', { n: g.files.length })} · {formatBytes(g.files.reduce((a, f) => a + (f.size || 0), 0))}
              </Text>
            )}
            {g.tools.length ? (
              <View style={styles.grid}>
                {g.tools.map((t, index) => {
                  const c = catColor(t.cat, theme);
                  return (
                    <Appear key={t.id} delay={Math.min(index, 10) * 25} duration={260} style={styles.cell}>
                      <PressableScale onPress={() => openTool(t, g.files)} accessibilityRole="button" accessibilityLabel={t.name} style={[styles.tool, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                        <View style={[styles.toolIcon, { backgroundColor: c + '1F' }]}>
                          <Icon name={g.kind === 'image' ? (t.cat === 'image' ? 'image' : 'pdf') : GROUP_ICON[g.kind]} size={20} color={c} />
                        </View>
                        <Text style={[type.caption, styles.flex, { color: theme.ink }]} numberOfLines={2}>
                          {t.name}
                        </Text>
                      </PressableScale>
                    </Appear>
                  );
                })}
              </View>
            ) : (
              <Text style={[type.bodySm, { color: theme.muted }]}>This tool isn’t available right now. Please try again later.</Text>
            )}
          </View>
        ))}
        {byKind.has('other') && (
          <Text style={[type.bodySm, { color: theme.muted }]}>Some shared files aren’t a type Fileora works with and were left out.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  head: { gap: 12, marginBottom: 4 },
  previews: { gap: 8 },
  preview: { width: 92, height: 120, borderRadius: 12, borderWidth: 1 },
  docPreview: { alignItems: 'center', justifyContent: 'center', gap: 4, padding: 6 },
  docName: { textAlign: 'center' },
  scan: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  group: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%' },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10, minHeight: 58 },
  toolIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
