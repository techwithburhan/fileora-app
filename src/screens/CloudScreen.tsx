/**
 * Cloud Storage: Google Drive, JioCloud and OneDrive. Fileora connects through each service's
 * Android app (the account signed in there): "Add Connection" checks the app is on the phone,
 * then Fileora files can be uploaded to it in one tap. Fileora never sees cloud passwords.
 */
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StackHeader from '../components/StackHeader';
import FileRow from '../components/FileRow';
import Icon from '../components/Icon';
import PressableScale from '../components/PressableScale';
import { Cloud, CLOUDS, playStoreUrl } from '../data/clouds';
import { native } from '../lib/native';
import { FileRec, store, useStore } from '../store/store';
import { Theme } from '../theme';
import { type } from '../typography';

type AppInfo = { installed: boolean; icon: string | null };

export default function CloudScreen({ theme }: { theme: Theme }) {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const clouds = useStore(s => s.clouds);
  const files = useStore(s => s.files);
  const [apps, setApps] = useState<Record<string, AppInfo>>({});
  const [uploadTo, setUploadTo] = useState<Cloud | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const out: Record<string, AppInfo> = {};
        for (const c of CLOUDS) {
          const installed = await native.isInstalled(c.pkg);
          out[c.id] = { installed, icon: installed ? await native.appIcon(c.pkg, 96) : null };
        }
        if (live) setApps(out);
      })();
      return () => {
        live = false;
      };
    }, []),
  );

  const connect = (c: Cloud) => {
    if (apps[c.id]?.installed) {
      store.setCloud(c.id, true);
      return;
    }
    Alert.alert(
      `${c.name} app needed`,
      `Fileora connects to ${c.name} through its app on your phone, with the account you are signed in to there. Install ${c.name} from Google Play, sign in, then tap Add Connection again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Get the app', onPress: () => Linking.openURL(`market://details?id=${c.pkg}`).catch(() => Linking.openURL(playStoreUrl(c.pkg))) },
      ],
    );
  };
  const disconnect = (c: Cloud) =>
    Alert.alert(`Disconnect ${c.name}?`, `Fileora will stop offering “Upload to ${c.name}”. Nothing is removed from your ${c.name}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => store.setCloud(c.id, false) },
    ]);
  const upload = (c: Cloud, f: FileRec) => {
    setUploadTo(null);
    native.shareToApp(f.path, f.mime, c.pkg).catch(e => Alert.alert(c.name, e instanceof Error ? e.message : String(e)));
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <StackHeader title="Cloud Storage" theme={theme} onBack={() => nav.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[type.bodySm, { color: theme.muted }]}>
          Save Fileora files to your cloud. Fileora works through each service’s app on this phone, so your cloud password and other files stay with that app.
        </Text>
        {CLOUDS.map((c, i) => {
          const info = apps[c.id];
          const connected = !!clouds[c.id];
          const missing = connected && info && !info.installed;
          return (
            <Animated.View
              key={c.id}
              entering={FadeInDown.delay(i * 50).duration(300).easing(Easing.out(Easing.cubic))}
              style={[styles.card, { backgroundColor: theme.surface, borderColor: connected && !missing ? theme.accent : theme.line }]}>
              <View style={styles.row}>
                <View style={[styles.logo, { backgroundColor: theme.surface2 }]}>
                  {info?.icon ? (
                    <Image source={{ uri: `data:image/png;base64,${info.icon}` }} style={styles.logoImg} accessibilityIgnoresInvertColors />
                  ) : (
                    <Icon name="cloud" size={26} color={theme.link} />
                  )}
                </View>
                <View style={styles.flex}>
                  <Text style={[type.heading, { color: theme.ink }]}>{c.name}</Text>
                  <Text style={[type.caption, { color: theme.muted }]}>
                    {missing ? `${c.name} app not found on this phone` : connected ? `Connected through the ${c.name} app` : c.desc}
                  </Text>
                </View>
                {connected && !missing && (
                  <View style={[styles.chip, { backgroundColor: theme.accent + '1F' }]}>
                    <Text style={[type.caption, { color: theme.accentInk }]}>Connected</Text>
                  </View>
                )}
              </View>
              {connected && !missing ? (
                <View style={styles.actions}>
                  <PressableScale onPress={() => setUploadTo(c)} accessibilityRole="button" style={[styles.btn, styles.flex, { backgroundColor: theme.accent }]}>
                    <Icon name="up" size={18} color={theme.onAccent} />
                    <Text style={[type.button, { color: theme.onAccent }]}>Upload a file</Text>
                  </PressableScale>
                  <PressableScale onPress={() => native.openApp(c.pkg)} accessibilityRole="button" accessibilityLabel={`Open ${c.name}`} style={[styles.btn, styles.square, { backgroundColor: theme.surface2 }]}>
                    <Icon name="external" size={19} color={theme.ink} />
                  </PressableScale>
                  <PressableScale onPress={() => disconnect(c)} accessibilityRole="button" accessibilityLabel={`Disconnect ${c.name}`} style={[styles.btn, styles.square, { backgroundColor: theme.surface2 }]}>
                    <Icon name="close" size={19} color={theme.ink} />
                  </PressableScale>
                </View>
              ) : (
                <PressableScale onPress={() => connect(c)} accessibilityRole="button" style={[styles.btn, { backgroundColor: theme.surface2 }]}>
                  <Icon name="link" size={18} color={theme.ink} />
                  <Text style={[type.button, { color: theme.ink }]}>Add Connection</Text>
                </PressableScale>
              )}
            </Animated.View>
          );
        })}
        <Text style={[type.caption, { color: theme.muted }]}>
          To open a file from your cloud, use Files → Internal storage: Google Drive and OneDrive appear in Android’s file picker menu.
        </Text>
      </ScrollView>

      {uploadTo && (
        <Modal transparent visible animationType="none" onRequestClose={() => setUploadTo(null)} statusBarTranslucent>
          <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setUploadTo(null)} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))} style={[styles.sheet, { backgroundColor: theme.bg, paddingBottom: insets.bottom + 12 }]}>
            <Text style={[type.section, { color: theme.ink }]}>Upload to {uploadTo.name}</Text>
            <FlatList
              data={files}
              keyExtractor={f => f.id}
              contentContainerStyle={styles.pickList}
              ListEmptyComponent={<Text style={[type.bodySm, { color: theme.muted }]}>No files in Fileora yet.</Text>}
              renderItem={({ item }) => <FileRow file={item} theme={theme} onPress={() => upload(uploadTo, item)} />}
            />
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { borderWidth: 1.5, borderRadius: 20, padding: 14, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: 40, height: 40 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flexDirection: 'row', gap: 8, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  square: { width: 48 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2,11,23,0.5)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 12 },
  pickList: { gap: 8 },
});
