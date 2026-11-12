/** Centered dialog with a text field and/or a checkbox (Scan complete, Rename, Save as PDF). */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated';
import Icon from './Icon';
import PressableScale from './PressableScale';
import { Theme } from '../theme';
import { type } from '../typography';

export default function Dialog({
  visible,
  title,
  label,
  value,
  check,
  okLabel = 'OK',
  theme,
  onCancel,
  onOk,
}: {
  visible: boolean;
  title: string;
  label?: string;
  value?: string;
  check?: { label: string; value: boolean };
  okLabel?: string;
  theme: Theme;
  onCancel: () => void;
  onOk: (text: string, checked: boolean) => void;
}) {
  const [text, setText] = useState(value ?? '');
  const [checked, setChecked] = useState(check?.value ?? false);
  useEffect(() => {
    if (visible) {
      setText(value ?? '');
      setChecked(check?.value ?? false);
    }
  }, [visible, value, check?.value]);
  if (!visible) return null;
  const ok = label === undefined || text.trim().length > 0;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior="padding" style={styles.center} pointerEvents="box-none">
        <Animated.View entering={FadeInDown.duration(240).easing(Easing.out(Easing.cubic))} style={[styles.card, { backgroundColor: theme.bg }]}>
          <Text style={[type.section, { color: theme.ink }]} accessibilityRole="header">
            {title}
          </Text>
          {label !== undefined && (
            <View style={[styles.field, { borderColor: theme.line, backgroundColor: theme.surface }]}>
              <Text style={[type.caption, { color: theme.muted }]}>{label}</Text>
              <TextInput
                value={text}
                onChangeText={setText}
                autoFocus
                selectTextOnFocus
                maxLength={80}
                style={[styles.input, { color: theme.ink }]}
                placeholderTextColor={theme.muted}
                accessibilityLabel={label}
              />
            </View>
          )}
          {check && (
            <Pressable onPress={() => setChecked(c => !c)} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.check} hitSlop={6}>
              <View style={[styles.box, { borderColor: checked ? theme.accent : theme.muted }, checked && { backgroundColor: theme.accent }]}>
                {checked && <Icon name="check" size={16} color="#fff" width={3} />}
              </View>
              <Text style={[type.body, { color: theme.ink }]}>{check.label}</Text>
            </Pressable>
          )}
          <View style={styles.buttons}>
            <PressableScale onPress={onCancel} accessibilityRole="button" style={styles.btn}>
              <Text style={[type.button, { color: theme.link }]}>Cancel</Text>
            </PressableScale>
            <PressableScale
              onPress={() => ok && onOk(text.trim(), checked)}
              disabled={!ok}
              accessibilityRole="button"
              style={[styles.btn, styles.okBtn, { backgroundColor: ok ? theme.accent : theme.surface2 }]}>
              <Text style={[type.button, { color: ok ? theme.onAccent : theme.muted }]}>{okLabel}</Text>
            </PressableScale>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,11,23,0.55)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 22, padding: 20, gap: 16 },
  field: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingTop: 6 },
  input: { fontSize: 16, minHeight: 40, paddingVertical: 4 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  okBtn: { minWidth: 96 },
});
