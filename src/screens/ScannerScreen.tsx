/**
 * Scanner tab: scanned images and the PDFs made from them, with a + button for Camera (ML Kit
 * document scanner) or Gallery (pick photos, review, make a PDF).
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../components/AppHeader';
import FileRow from '../components/FileRow';
import Icon, { IconName } from '../components/Icon';
import PressableScale from '../components/PressableScale';
import ResultSheet from '../components/ResultSheet';
import { scanWithCamera } from '../lib/scan';
import { pickFiles } from '../lib/pick';
import { confirmDelete, confirmDiscard, openRecord } from '../lib/openFile';
import { useKeepGoing } from '../lib/keepGoing';
import { FileRec, store, useStore } from '../store/store';
import { Theme } from '../theme';
import { type } from '../typography';

export default function ScannerScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const files = useStore(s => s.files);
  const images = useMemo(() => files.filter(f => f.source === 'scan-image'), [files]);
  const pdfs = useMemo(() => files.filter(f => f.source === 'scan'), [files]);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FileRec | null>(null);
  const keepGoing = useKeepGoing();

  const camera = async () => {
    setMenu(false);
    store.logOpen('scan');
    try {
      setBusy(true);
      const pdf = await scanWithCamera();
      setBusy(false);
      if (pdf) setResult(pdf);
    } catch (e) {
      setBusy(false);
      Alert.alert('Scanning didn’t work', e instanceof Error ? e.message : String(e));
    }
  };

  const gallery = async () => {
    setMenu(false);
    store.logOpen('scan');
    try {
      const picked = await pickFiles('jpgpng', true);
      if (picked.length) nav.navigate('ScanReview', { images: picked });
    } catch (e) {
      Alert.alert('Couldn’t open the photos', e instanceof Error ? e.message : String(e));
    }
  };

  const tileW = '31.5%';
  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <AppHeader theme={theme} />
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={[type.title, { color: theme.ink }]} accessibilityRole="header">
            Scanner
          </Text>
          <Text style={[type.bodySm, { color: theme.muted }]}>Scan paper documents into clean PDFs. Scans stay on this phone.</Text>
        </View>

        {/* Part 1: scanned images */}
        <View style={styles.secHead}>
          <Text style={[type.section, styles.flex, { color: theme.ink }]} accessibilityRole="header">
            Scanned images
          </Text>
          {images.length > 0 && <Text style={[type.caption, { color: theme.muted }]}>{images.length}</Text>}
        </View>
        {images.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Icon name="image" size={30} color={theme.muted} />
            <Text style={[type.heading, { color: theme.ink }]}>No file scanned</Text>
            <Text style={[type.bodySm, styles.centerText, { color: theme.muted }]}>Tap + to scan with the camera or pick photos.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {images.map((f, i) => (
              <Animated.View key={f.id} entering={FadeInDown.delay(Math.min(i, 9) * 30).duration(280)} style={{ width: tileW }}>
                <PressableScale
                  onPress={() => openRecord(f)}
                  onLongPress={() => confirmDiscard(() => store.removeFile(f.id))}
                  accessibilityRole="button"
                  accessibilityLabel={`${f.name}. Open. Long press to discard`}
                  style={[styles.tile, { backgroundColor: theme.surface2, borderColor: theme.line }]}>
                  <Image source={{ uri: `file://${f.path}` }} style={styles.tileImg} resizeMode="cover" />
                  <Pressable
                    onPress={() => confirmDiscard(() => store.removeFile(f.id))}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Discard ${f.name}`}
                    style={styles.tileX}>
                    <Icon name="trash" size={15} color="#fff" />
                  </Pressable>
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Part 2: PDFs */}
        <View style={styles.secHead}>
          <Text style={[type.section, styles.flex, { color: theme.ink }]} accessibilityRole="header">
            Converted PDFs
          </Text>
          {pdfs.length > 0 && <Text style={[type.caption, { color: theme.muted }]}>{pdfs.length}</Text>}
        </View>
        {pdfs.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Icon name="pdf" size={30} color={theme.muted} />
            <Text style={[type.heading, { color: theme.ink }]}>No PDF yet</Text>
            <Text style={[type.bodySm, styles.centerText, { color: theme.muted }]}>Each scan is saved as a PDF here and in Downloads/Fileora.</Text>
          </View>
        ) : (
          pdfs.map(f => <FileRow key={f.id} file={f} theme={theme} onPress={() => openRecord(f)} onMore={() => confirmDelete(f, 'PDF')} />)
        )}
      </ScrollView>

      <Animated.View entering={ZoomIn.delay(200).springify().damping(13)} style={styles.fabWrap}>
        <PressableScale onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="New scan" style={[styles.fab, { backgroundColor: theme.accent }]}>
          <Icon name="plus" size={30} color="#03213F" width={2.6} />
        </PressableScale>
      </Animated.View>

      {menu && (
        <Modal transparent visible animationType="none" onRequestClose={() => setMenu(false)} statusBarTranslucent>
          <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(false)} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View entering={SlideInDown.springify().damping(18)} style={[styles.sheet, { backgroundColor: theme.bg, paddingBottom: insets.bottom + 18 }]}>
            <Text style={[type.section, { color: theme.ink }]}>New scan</Text>
            {(
              [
                { icon: 'camera', title: 'Camera', sub: 'Auto edges, crop & rotate, filters (photo, document, B&W), retake and more pages', go: camera },
                { icon: 'image', title: 'Gallery', sub: 'Pick JPG or PNG photos, put them in order and make a PDF', go: gallery },
              ] as { icon: IconName; title: string; sub: string; go: () => void }[]
            ).map(o => (
              <PressableScale key={o.title} onPress={o.go} accessibilityRole="button" style={[styles.option, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <View style={[styles.optIcon, { backgroundColor: theme.accent + '1F' }]}>
                  <Icon name={o.icon} size={22} color={theme.dark ? theme.accent : '#0F7F49'} />
                </View>
                <View style={styles.flex}>
                  <Text style={[type.heading, { color: theme.ink }]}>{o.title}</Text>
                  <Text style={[type.bodySm, { color: theme.muted }]}>{o.sub}</Text>
                </View>
                <Icon name="chevron" size={18} color={theme.muted} />
              </PressableScale>
            ))}
            <PressableScale onPress={() => setMenu(false)} accessibilityRole="button" style={[styles.cancel, { backgroundColor: theme.surface2 }]}>
              <Text style={[type.button, { color: theme.ink }]}>Cancel</Text>
            </PressableScale>
          </Animated.View>
        </Modal>
      )}

      {busy && (
        <View style={[StyleSheet.absoluteFill, styles.busy]}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      )}

      <ResultSheet
        file={result}
        tool="scan"
        theme={theme}
        note="Saved in Scanner and in Downloads/Fileora on this phone."
        onClose={() => setResult(null)}
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
  content: { padding: 16, gap: 14, paddingBottom: 110 },
  secHead: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  empty: { alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 18, padding: 22 },
  centerText: { textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { aspectRatio: 0.75, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  tileImg: { width: '100%', height: '100%' },
  tileX: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(2,11,23,0.6)', alignItems: 'center', justifyContent: 'center' },
  fabWrap: { position: 'absolute', right: 18, bottom: 18 },
  fab: { width: 62, height: 62, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2,11,23,0.55)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  optIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancel: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  busy: { backgroundColor: 'rgba(2,11,23,0.35)', alignItems: 'center', justifyContent: 'center' },
});
