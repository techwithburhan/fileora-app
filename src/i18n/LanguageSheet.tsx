/**
 * Language picker (top bar → language button): the ten app languages by their own names. The
 * choice is saved on the phone and applies at once; Urdu and Arabic also mirror the layout.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Text from './Text';
import { LANGS, LangCode, setLang, tr, useLang } from './i18n';
import Icon from '../components/Icon';
import { Theme } from '../theme';
import { type } from '../typography';

const listeners = new Set<(open: boolean) => void>();
/** Opens the picker from anywhere (the top bar, the menu, Settings). */
export function openLanguageSheet() {
  listeners.forEach(l => l(true));
}

export default function LanguageSheet({ theme }: { theme: Theme }) {
  const [open, setOpen] = useState(false);
  const [restartNote, setRestartNote] = useState(false);
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const l = (o: boolean) => {
      setRestartNote(false);
      setOpen(o);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!open) return null;

  const choose = (code: LangCode) => {
    const restart = setLang(code);
    if (restart) setRestartNote(true);
    else setOpen(false);
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => setOpen(false)} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel={tr('Close')} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))}
        style={[styles.sheet, { backgroundColor: theme.bg, paddingBottom: insets.bottom + 12 }]}
        accessibilityViewIsModal>
        <View style={styles.head}>
          <Icon name="globe" size={22} color={theme.accentInk} />
          <Text style={[type.section, { color: theme.ink }]} accessibilityRole="header">
            App language
          </Text>
        </View>
        {restartNote ? (
          <View style={[styles.note, { backgroundColor: theme.surface2, borderColor: theme.line }]}>
            <Text style={[type.bodySm, { color: theme.ink2 }]}>
              The layout is now mirrored. Close and reopen Fileora once for the full right-to-left layout everywhere.
            </Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" style={[styles.ok, { backgroundColor: theme.accent }]}>
              <Text style={[type.button, { color: theme.onAccent }]}>OK</Text>
            </Pressable>
          </View>
        ) : null}
        <ScrollView contentContainerStyle={styles.list}>
          {LANGS.map(l => {
            const on = l.code === lang;
            return (
              <Pressable
                key={l.code}
                onPress={() => choose(l.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${l.native} (${l.name})`}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: on ? theme.accent + (theme.dark ? '29' : '1F') : theme.surface, borderColor: on ? theme.accent : theme.line, opacity: pressed ? 0.8 : 1 },
                ]}>
                <View style={[styles.code, { backgroundColor: theme.surface2 }]}>
                  <Text noTranslate style={[type.caption, { color: theme.ink }]}>
                    {l.short}
                  </Text>
                </View>
                <View style={styles.names}>
                  <Text noTranslate style={[type.heading, { color: theme.ink }]}>
                    {l.native}
                  </Text>
                  <Text noTranslate style={[type.caption, { color: theme.muted }]}>
                    {l.name}
                  </Text>
                </View>
                {on ? <Icon name="check" size={20} color={theme.accentInk} /> : null}
              </Pressable>
            );
          })}
          <Text style={[type.caption, styles.hint, { color: theme.muted }]}>
            Translations are new: if something reads wrong, tell us through Contact.
          </Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,15,33,0.55)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '86%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 8 },
  note: { marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  ok: { alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  code: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  names: { flex: 1 },
  hint: { textAlign: 'center', paddingVertical: 10 },
});
