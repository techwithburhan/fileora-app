/** Gallery photos → review (order, discard, add pages) → one PDF. */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import StackHeader from '../components/StackHeader';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import ResultSheet from '../components/ResultSheet';
import { makePdf, SCAN_PAGE_LIMIT } from '../lib/scan';
import { pickFiles, Picked } from '../lib/pick';
import { saveResult, stamp } from '../lib/output';
import { confirmDiscard, openRecord } from '../lib/openFile';
import { useKeepGoing } from '../lib/keepGoing';
import { formatBytes } from '../store/files';
import { FileRec } from '../store/store';
import { RootStackParamList } from '../navigation/types';
import { Theme } from '../theme';
import { type } from '../typography';

export default function ScanReviewScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ScanReview'>>();
  const [items, setItems] = useState<Picked[]>(params.images.slice(0, SCAN_PAGE_LIMIT));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FileRec | null>(null);
  const keepGoing = useKeepGoing();

  const add = async () => {
    try {
      const more = await pickFiles('jpgpng', true);
      setItems(old => {
        const next = [...old, ...more];
        if (next.length > SCAN_PAGE_LIMIT) Alert.alert('Page limit', `A scan can have up to ${SCAN_PAGE_LIMIT} pages.`);
        return next.slice(0, SCAN_PAGE_LIMIT);
      });
    } catch (e) {
      Alert.alert('Couldn’t open the photos', e instanceof Error ? e.message : String(e));
    }
  };
  const move = (i: number, d: -1 | 1) =>
    setItems(old => {
      const j = i + d;
      if (j < 0 || j >= old.length) return old;
      const n = [...old];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const process = async () => {
    if (!items.length) return;
    setBusy(true);
    try {
      const base = `scan-${stamp()}`;
      const pdf = await makePdf(items, base);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const ext = it.mime === 'image/png' ? 'png' : 'jpg';
        await saveResult({ name: `${base}-${i + 1}.${ext}`, fromPath: it.path, mime: it.mime, source: 'scan-image', publish: false });
      }
      setResult(pdf);
    } catch (e) {
      Alert.alert('The PDF couldn’t be made', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title="Review pages" theme={theme} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.bodySm, { color: theme.muted }]}>
          Each photo becomes one page, in this order. For automatic edges, crop and filters, use Camera in the Scanner (it can also import from the gallery).
        </Text>
        {items.map((it, i) => (
          <Animated.View key={it.key} entering={FadeIn} exiting={FadeOut} layout={LinearTransition.springify().damping(18)}>
            <View style={[styles.page, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Image source={{ uri: `file://${it.path}` }} style={[styles.preview, { backgroundColor: theme.surface2 }]} resizeMode="contain" />
              <View style={styles.flex}>
                <Text style={[type.heading, { color: theme.ink }]}>Page {i + 1}</Text>
                <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
                  {it.name} · {formatBytes(it.size)}
                </Text>
              </View>
              <View style={styles.tools}>
                <PressableScale onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6} accessibilityLabel={`Move page ${i + 1} up`}>
                  <Icon name="up" size={19} color={i === 0 ? theme.line : theme.ink2} />
                </PressableScale>
                <PressableScale onPress={() => move(i, 1)} disabled={i === items.length - 1} hitSlop={6} accessibilityLabel={`Move page ${i + 1} down`}>
                  <Icon name="down" size={19} color={i === items.length - 1 ? theme.line : theme.ink2} />
                </PressableScale>
              </View>
              <PressableScale
                onPress={() => confirmDiscard(() => setItems(old => old.filter(x => x.key !== it.key)))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Discard page ${i + 1}`}
                style={styles.x}>
                <Icon name="trash" size={19} color={theme.danger} />
              </PressableScale>
            </View>
          </Animated.View>
        ))}
        {items.length === 0 && <Text style={[type.body, styles.center, { color: theme.muted }]}>All pages were discarded.</Text>}
        {items.length < SCAN_PAGE_LIMIT && (
          <PressableScale onPress={add} accessibilityRole="button" style={[styles.add, { backgroundColor: theme.surface2 }]}>
            <Icon name="plus" size={20} color={theme.ink} />
            <Text style={[type.button, { color: theme.ink }]}>Add pages</Text>
          </PressableScale>
        )}
        <PressableScale
          onPress={process}
          disabled={!items.length || busy}
          accessibilityRole="button"
          style={[styles.go, { backgroundColor: items.length ? theme.accent : theme.surface2 }]}>
          {busy ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={[type.button, styles.goText, { color: items.length ? theme.onAccent : theme.muted }]}>
              {items.length ? `Make PDF (${items.length} ${items.length === 1 ? 'page' : 'pages'})` : 'Add a photo first'}
            </Text>
          )}
        </PressableScale>
      </ScrollView>
      <ResultSheet
        file={result}
        tool="scan"
        theme={theme}
        note="Saved in Scanner and in Downloads/Fileora on this phone."
        onClose={() => {
          setResult(null);
          nav.goBack();
        }}
        onOpen={openRecord}
        onNext={(id, f) => {
          setResult(null);
          keepGoing(id, f);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  goText: { fontSize: 16.5 },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  page: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 10 },
  preview: { width: 64, height: 84, borderRadius: 10 },
  tools: { gap: 10 },
  x: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center', padding: 16 },
  add: { flexDirection: 'row', gap: 8, minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  go: { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
