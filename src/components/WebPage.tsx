/**
 * A fileora.in page inside the app (tool pages, ATS Resume, blog posts, information pages).
 * Animated loading bar, Android back goes back inside the page first, other websites open in
 * the phone's browser, downloads are saved to Downloads/Fileora, file pickers work.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, StyleSheet, Text, View } from 'react-native';
import BlobUtil from 'react-native-blob-util';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// The package's typings give WebView<undefined> the props type `never`; pin the generic.
const WV = WebView<object>;
import { useFocusEffect } from '@react-navigation/native';
import { SITE_HOSTS } from '../config';
import { fileInjection, injectedScript } from '../lib/webBridge';
import type { InjectFile } from '../navigation/types';
import { DownloadMessage, handleDownloadMessage } from '../lib/downloads';
import { brand, Theme } from '../theme';
import Icon from './Icon';
import PressableScale from './PressableScale';

function allowedInApp(url: string): boolean {
  if (/^(about:|blob:|data:)/.test(url)) return true;
  const m = /^https:\/\/([^/:?#]+)/i.exec(url);
  return !!m && SITE_HOSTS.includes(m[1].toLowerCase());
}

export default function WebPage({
  url,
  theme,
  onBackAtStart,
  tool,
  inject,
}: {
  url: string;
  theme: Theme;
  onBackAtStart?: () => void;
  tool?: string;
  /** files to put into the tool page's file chooser (shared images, "keep going" results) */
  inject?: InjectFile[];
}) {
  const ref = useRef<WebView<object>>(null);
  const injected = useRef(false);
  const giveFiles = async () => {
    if (!inject?.length || injected.current) return;
    injected.current = true;
    try {
      const files = [];
      for (const f of inject) files.push({ name: f.name, mime: f.mime, data: await BlobUtil.fs.readFile(f.path, 'base64') });
      ref.current?.injectJavaScript(fileInjection(files));
    } catch {
      Alert.alert('Choose the file on the page', 'The file couldn’t be added automatically. Tap “Choose files” on the page.');
    }
  };
  const canGoBack = useRef(false);
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0);
  const progress = useSharedValue(0);
  const shown = useSharedValue(1);

  const bar = useAnimatedStyle(() => ({ width: `${progress.value * 100}%`, opacity: shown.value }));

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack.current) {
          ref.current?.goBack();
          return true;
        }
        if (onBackAtStart) {
          onBackAtStart();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [onBackAtStart]),
  );

  useEffect(() => {
    setError(false);
  }, [url]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as DownloadMessage;
      if (msg && typeof msg.type === 'string' && msg.type.startsWith('dl-')) handleDownloadMessage(msg, tool);
      else if ((msg as { type: string }).type === 'inject-fail')
        Alert.alert('Choose the file on the page', 'The file couldn’t be added automatically. Tap “Choose files” on the page.');
    } catch {
      // not ours
    }
  };

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Icon name="cloud" size={44} color={theme.muted} />
        <Text style={[styles.errTitle, { color: theme.ink }]}>Page couldn’t load</Text>
        <Text style={[styles.errText, { color: theme.muted }]}>Check your internet connection and try again.</Text>
        <PressableScale
          onPress={() => {
            setError(false);
            setKey(k => k + 1);
          }}
          accessibilityRole="button"
          style={[styles.retry, { backgroundColor: theme.accent }]}>
          <Icon name="refresh" size={18} color={theme.onAccent} />
          <Text style={[styles.retryText, { color: theme.onAccent }]}>Try again</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: theme.bg }]}>
      <WV
        key={key}
        ref={ref}
        source={{ uri: url }}
        style={{ backgroundColor: theme.bg }}
        injectedJavaScriptBeforeContentLoaded={injectedScript(theme.dark)}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess={false}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        mixedContentMode="never"
        originWhitelist={['https://*', 'about:*', 'blob:*', 'data:*']}
        onShouldStartLoadWithRequest={req => {
          if (allowedInApp(req.url)) return true;
          if (/^(https?|mailto|tel):/i.test(req.url)) Linking.openURL(req.url).catch(() => {});
          return false;
        }}
        onNavigationStateChange={s => {
          canGoBack.current = s.canGoBack;
        }}
        onLoadStart={() => {
          shown.value = 1;
          progress.value = 0.05;
        }}
        onLoadProgress={e => {
          progress.value = withTiming(e.nativeEvent.progress, { duration: 200 });
        }}
        onLoadEnd={() => {
          progress.value = withTiming(1, { duration: 150 });
          shown.value = withTiming(0, { duration: 400 });
          giveFiles();
        }}
        onError={() => setError(true)}
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.center, StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}>
            <ActivityIndicator color={brand.green} size="large" />
          </View>
        )}
      />
      <Animated.View style={[styles.bar, { backgroundColor: theme.accent }, bar]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  bar: { position: 'absolute', top: 0, left: 0, height: 3, borderRadius: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  errTitle: { fontSize: 18, fontWeight: '800', marginTop: 6 },
  errText: { fontSize: 14.5, textAlign: 'center', lineHeight: 21 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, minHeight: 46, borderRadius: 14, marginTop: 8 },
  retryText: { fontSize: 15, fontWeight: '800' },
});
