/**
 * Full-screen states controlled from WordPress (Fileora → App Center):
 * - Complete app maintenance mode (App Center → Manage).
 * - Force update: this version is below the minimum version (App Center → Versions).
 * Both cover the app until the website lifts them; "Try again" re-reads the settings.
 *
 * If a task is running (processing a file, saving a scan, a download), the screen waits until
 * it has finished, with a small notice at the top, so nobody loses work halfway. Saves are
 * written before the screen appears.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, ScrollView, StyleSheet, View } from 'react-native';
import Text from '../i18n/Text';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';
import { SHARE_URL } from '../config';
import { mustUpdate, remote, requiredVersion, useRemote } from '../remote/remote';
import { useBusy } from '../lib/busy';
import { flushAll } from '../lib/safeFile';
import { brand } from '../theme';
import { APP_VERSION } from '../version';
import { tr } from '../i18n/i18n';

export function useGate(): 'maintenance' | 'update' | null {
  const config = useRemote(s => s.config);
  if (!config) return null;
  if (config.app_maintenance) return 'maintenance';
  // app 1.2: normalised versions, App Center's on/off switch, and a minimum above "latest" is
  // capped at "latest" (see requiredVersion), so an installed newest version is never blocked
  if (mustUpdate(APP_VERSION, config.update)) return 'update';
  return null;
}

export default function RemoteGate() {
  const wanted = useGate();
  const working = useBusy();
  const gate = wanted && !working ? wanted : null;
  const config = useRemote(s => s.config);
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!gate) return;
    flushAll(); // write pending saves before covering the app
    // Back leaves the app instead of moving around behind the screen
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, [gate]);

  if (wanted && working)
    return (
      <View style={[styles.wait, { top: insets.top + 6 }]} pointerEvents="none" accessibilityLiveRegion="polite">
        <Text style={styles.waitText}>
          {wanted === 'update' ? 'An update is needed. Finishing your task first…' : 'Maintenance is starting. Finishing your task first…'}
        </Text>
      </View>
    );
  if (!gate || !config) return null;

  const required = requiredVersion(config.update);
  const retry = async () => {
    setBusy(true);
    setErr(null);
    const e = await remote.refresh(true); // always from the website, never a cached copy
    setBusy(false);
    if (e) setErr('Couldn’t reach fileora.in. Check your internet connection and try again.');
    else if (mustUpdate(APP_VERSION, remote.get().config?.update))
      setErr(tr('Checked just now: this phone still has version {version}; {required} or newer is needed. If you already installed the update, the download may have given an older version.', { version: APP_VERSION, required }));
  };
  const update = () => {
    flushAll();
    Linking.openURL(config.update.url || SHARE_URL).catch(() =>
      setErr('Couldn’t open the update link. Download the newest version from fileora.in.'),
    );
  };
  const isApk = /\.apk(\?|#|$)/i.test(config.update.url);

  const m = config.app_maintenance;
  const view: { icon: IconName; title: string; text: string; notes?: string } =
    gate === 'maintenance'
      ? { icon: 'settings', title: m?.title || 'Fileora is under maintenance', text: m?.text || 'We’re making some improvements. Please check back soon.' }
      : {
          icon: 'download',
          title: config.update.title || 'Please update Fileora',
          text:
            (config.update.message
              ? config.update.message.split('{version}').join(APP_VERSION).split('{required}').join(required)
              : tr('This version ({version}) is no longer supported. Install version {required} or later to keep using the app. Your files stay on this phone.', { version: APP_VERSION, required })) +
            (isApk ? ' ' + tr('The download starts in your browser: open it when it finishes and tap Update.') : ''),
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
        {gate === 'update' && (
          <Animated.View entering={FadeInDown.duration(300).delay(120)} style={styles.vers}>
            <View style={styles.ver}>
              <Text style={styles.verHead}>INSTALLED</Text>
              <Text style={styles.verVal}>{APP_VERSION}</Text>
            </View>
            <Icon name="chevron" size={18} color="#9FE3C1" />
            <View style={styles.ver}>
              <Text style={styles.verHead}>REQUIRED</Text>
              <Text style={styles.verVal}>{required}</Text>
            </View>
          </Animated.View>
        )}
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
  vers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  ver: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16, minWidth: 96 },
  verHead: { color: '#9FE3C1', fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  verVal: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  wait: { position: 'absolute', left: 16, right: 16, zIndex: 50, elevation: 50, backgroundColor: brand.navy, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  waitText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
});
