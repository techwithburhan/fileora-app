/**
 * Success pop-up after a task (shown only when it worked): confetti, "Congratulations! Your files
 * are completed successfully.", open the file, and keep going with it in a related tool
 * (e.g. after Merge PDF: Compress, Sign, Watermark, Page Number).
 */
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInUp } from 'react-native-reanimated';
import Confetti from './Confetti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FileThumb from './FileThumb';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { formatBytes } from '../store/files';
import { FileRec } from '../store/store';
import { relatedFor } from '../data/nativeTools';
import { toolById } from '../data/tools';
import { catColor, Theme } from '../theme';
import { type } from '../typography';

export default function ResultSheet({
  file,
  tool,
  theme,
  onClose,
  onOpen,
  onNext,
  note,
  openLabel,
}: {
  file: FileRec | null;
  tool: string;
  theme: Theme;
  onClose: () => void;
  onOpen: (f: FileRec) => void;
  onNext: (toolId: string, f: FileRec) => void;
  note?: string;
  /** e.g. "View scan" when the result is a scanned document */
  openLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  if (!file) return null;
  const next = relatedFor(tool, file.mime).map(toolById).filter(Boolean) as NonNullable<ReturnType<typeof toolById>>[];
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        entering={FadeInUp.duration(320).easing(Easing.out(Easing.cubic))}
        style={[styles.sheet, { backgroundColor: theme.bg, paddingBottom: insets.bottom + 18 }]}>
        <ScrollView contentContainerStyle={styles.body} bounces={false}>
          <Animated.View entering={FadeIn.delay(80).duration(260)} style={[styles.okIcon, { backgroundColor: theme.accent }]}>
            <Icon name="party" size={30} color="#fff" width={2.2} />
          </Animated.View>
          <View accessible accessibilityRole="header" accessibilityLiveRegion="polite">
            <Text style={[type.title, styles.center, { color: theme.ink }]}>Congratulations!</Text>
            <Text style={[type.body, styles.center, { color: theme.ink2 }]}>Your files are completed successfully.</Text>
          </View>
          <Text style={[type.bodySm, styles.center, { color: theme.muted }]}>{note ?? 'Saved in Files and in Downloads/Fileora on this phone.'}</Text>
          <View style={[styles.file, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <FileThumb path={file.path} mime={file.mime} name={file.name} theme={theme} size={46} />
            <View style={styles.flex}>
              <Text style={[type.heading, { color: theme.ink }]} numberOfLines={2}>
                {file.name}
              </Text>
              <Text style={[type.caption, { color: theme.muted }]}>
                {formatBytes(file.size)}
                {file.pages ? ` · ${file.pages} ${file.pages === 1 ? 'page' : 'pages'}` : ''}
              </Text>
            </View>
          </View>
          <PressableScale onPress={() => onOpen(file)} accessibilityRole="button" style={[styles.btn, { backgroundColor: theme.accent }]}>
            <Text style={[type.button, { color: theme.onAccent }]}>{openLabel ?? 'Open file'}</Text>
          </PressableScale>
          {next.length > 0 && (
            <>
              <Text style={[type.overline, styles.keep, { color: theme.muted }]}>KEEP GOING WITH THIS FILE</Text>
              <View style={styles.grid}>
                {next.map(t => {
                  const c = catColor(t.cat, theme);
                  return (
                    <PressableScale
                      key={t.id}
                      onPress={() => onNext(t.id, file)}
                      accessibilityRole="button"
                      accessibilityLabel={t.name}
                      style={[styles.next, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                      <View style={[styles.nextIcon, { backgroundColor: c + '1F' }]}>
                        <Icon name={t.cat as IconName} size={20} color={c} />
                      </View>
                      <Text style={[type.caption, { color: theme.ink }]} numberOfLines={2}>
                        {t.name}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </>
          )}
          <PressableScale onPress={onClose} accessibilityRole="button" style={[styles.btn, { backgroundColor: theme.surface2 }]}>
            <Text style={[type.button, { color: theme.ink }]}>Done</Text>
          </PressableScale>
        </ScrollView>
      </Animated.View>
      <Confetti play={!!file} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  keep: { marginTop: 8 },
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,11,23,0.55)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  body: { padding: 20, gap: 12 },
  okIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  center: { textAlign: 'center' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10 },
  btn: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  next: { width: '47.5%', flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10, minHeight: 56 },
  nextIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
