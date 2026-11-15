/**
 * Full-screen states controlled from WordPress (Fileora → App Center):
 * - Complete app maintenance mode (App Center → Manage).
 * - Force update: this version is below the minimum version (App Center → Versions).
 * Both cover the app until the website lifts them; "Try again" re-reads the settings.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { SHARE_URL } from '../config';
import { cmpVersion, remote, useRemote } from '../remote/remote';
import { brand } from '../theme';
import { APP_VERSION } from '../version';

export function useGate(): 'maintenance' | 'update' | null {
  const config = useRemote(s => s.config);
  if (!config) return null;
  if (config.app_maintenance) return 'maintenance';
  if (config.update.min && cmpVersion(APP_VERSION, config.update.min) < 0) return 'update';
  return null;
}

export default function RemoteGate() {
  const gate = useGate();
  const config = useRemote(s => s.config);
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!gate || !config) return null;

  const retry = async () => {
    setBusy(true);
    setErr(null);
    const e = await remote.refresh(true);
    setBusy(false);
    if (e) setErr('Couldn’t reach fileora.in. Check your internet connection and try again.');
  };
  const update = () => Linking.openURL(config.update.url || SHARE_URL).catch(() => {});

  const m = config.app_maintenance;
  const view: { icon: IconName; title: string; text: string; notes?: string } =
    gate === 'maintenance'
      ? { icon: 'settings', title: m?.title || 'Fileora is under maintenance', text: m?.text || 'We’re making some improvements. Please check back soon.' }
      : {
          icon: 'download',
          title: 'Please update Fileora',
          text: `This version (${APP_VERSION}) is no longer supported. Install version ${config.update.latest || config.update.min} or later to keep using the app. Your files stay on this phone.`,
          notes: config.update.notes,
        };

  return (
    <Animated.View entering={FadeIn.duration(250)} style={[StyleSheet.absoluteFill, styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.icon}>
          <Icon name={view.icon} size={34} color={brand.green} width={2.2} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {view.title}
        </Text>
        <Text style={styles.text}>{view.text}</Text>
        {!!view.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesHead}>WHAT’S NEW</Text>
            <Text style={styles.notesText}>{view.notes}</Text>
          </View>
        )}
        {gate === 'update' && (
          <PressableScale onPress={update} accessibilityRole="button" style={[styles.btn, { backgroundColor: brand.green }]}>
            <Icon name="download" size={18} color="#03213F" width={2.3} />
            <Text style={styles.btnText}>Update now</Text>
          </PressableScale>
        )}
        <PressableScale onPress={retry} disabled={busy} accessibilityRole="button" style={[styles.btn, gate === 'update' ? styles.ghost : { backgroundColor: brand.green }]}>
          {busy ? <ActivityIndicator color={gate === 'update' ? '#FFFFFF' : '#03213F'} /> : <Icon name="refresh" size={18} color={gate === 'update' ? '#FFFFFF' : '#03213F'} width={2.3} />}
          <Text style={[styles.btnText, gate === 'update' && styles.ghostText]}>Try again</Text>
        </PressableScale>
        {!!err && (
          <Text style={styles.err} accessibilityLiveRegion="polite">
            {err}
          </Text>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: brand.navy, zIndex: 50, elevation: 50 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
  icon: { width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(23,175,100,0.16)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center' },
  text: { color: '#D3E2F5', fontSize: 15.5, lineHeight: 23, textAlign: 'center' },
  notes: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14, gap: 6 },
  notesHead: { color: '#9FE3C1', fontSize: 11.5, fontWeight: '800', letterSpacing: 1 },
  notesText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  btn: { minHeight: 50, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnText: { color: '#03213F', fontSize: 15.5, fontWeight: '800' },
  ghost: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)' },
  ghostText: { color: '#FFFFFF' },
  err: { color: '#FFD9A0', fontSize: 13.5, lineHeight: 19, textAlign: 'center' },
});
