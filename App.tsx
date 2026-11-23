/**
 * Fileora app – animated splash, 6 tabs (Home, Tools, Scanner, Files, Alerts, Settings) + side menu,
 * native Merge / Watermark / Page numbers on the phone, server tools through the public fileora.in
 * API, a document scanner, and files and activity kept on this phone.
 *
 * Fileora → App Center (WordPress plugin) controls the app without a new APK: API tools, tool
 * status, maintenance, announcement, force update, links, popular tools (src/remote/remote.ts),
 * and sends push notifications through Firebase (src/remote/push.ts). Check-ins and anonymous
 * usage go to App Monitoring (src/remote/telemetry.ts).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StatusBar, StyleSheet, View } from 'react-native';
import Alert from './src/i18n/Alert';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, NavigationContainer, getFocusedRouteNameFromRoute, useRoute } from '@react-navigation/native';
import AppHeader from './src/components/AppHeader';
import { headerScroll } from './src/components/headerScroll';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AnimatedTabBar from './src/components/AnimatedTabBar';
import MenuSheet from './src/components/MenuSheet';
import { MenuProvider } from './src/components/MenuContext';
import SplashIntro from './src/components/SplashIntro';
import ActivityScreen from './src/screens/ActivityScreen';
import BlogScreen from './src/screens/BlogScreen';
import FilesScreen from './src/screens/FilesScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProcessScreen from './src/screens/ProcessScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import AlertDetailScreen from './src/screens/AlertDetailScreen';
import InAppBanner from './src/components/InAppBanner';
import Onboarding, { useNeedsOnboarding } from './src/components/Onboarding';
import PromoScreen from './src/screens/PromoScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import ScanEditorScreen from './src/screens/ScanEditorScreen';
import ScanDocScreen from './src/screens/ScanDocScreen';
import SharedScreen from './src/screens/SharedScreen';
import RecycleBinScreen from './src/screens/RecycleBinScreen';
import CloudScreen from './src/screens/CloudScreen';
import { native } from './src/lib/native';
import SettingsScreen from './src/screens/SettingsScreen';
import ToolScreen from './src/screens/ToolScreen';
import ToolsScreen from './src/screens/ToolsScreen';
import WebScreen from './src/screens/WebScreen';
import { store } from './src/store/store';
import { navigationRef, RootStackParamList, TabParamList } from './src/navigation/types';
import { setAnalyticsEnabled, trackScreen } from './src/analytics';
import { Theme, useTheme } from './src/theme';
import RemoteGate, { useGate } from './src/components/RemoteGate';
import EngineHost from './src/engine/EngineHost';
import SelfTest from './src/engine/SelfTest';
import ErrorBoundary, { installGlobalErrorHandler } from './src/components/ErrorBoundary';
import { flushAll } from './src/lib/safeFile';
import { effectivePrefs, remote } from './src/remote/remote';
import { telemetry } from './src/remote/telemetry';
import { onNavigationReady, startPush, syncTopics } from './src/remote/push';
import { inbox } from './src/remote/inbox';
import { loadAds } from './src/ads/ads';
import { syncRtl, useLang } from './src/i18n/i18n';
import LanguageSheet from './src/i18n/LanguageSheet';
import { FestivalOverlay, useFestivalPrefetch } from './src/festival/Festival';

/** Reads App Center settings; reports only real server answers as errors (not "offline"). */
installGlobalErrorHandler();

async function refreshConfig(force = false) {
  const err = await remote.refresh(force);
  if (err && /HTTP|unexpected/.test(err)) telemetry.track('error', undefined, 0, err);
}

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function TabsScreen({ theme }: { theme: Theme }) {
  const renderBar = useCallback((props: React.ComponentProps<typeof AnimatedTabBar>) => <AnimatedTabBar {...props} theme={theme} />, [theme]);
  const tab = getFocusedRouteNameFromRoute(useRoute()) ?? 'Home';
  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
    {/* one top bar for every tab: it stays still while the tabs switch (no second logo or shadow edge) */}
    <AppHeader theme={theme} scrollY={headerScroll} search={tab !== 'Tools'} />
    <Tabs.Navigator
      screenOptions={{ headerShown: false, animation: 'shift', sceneStyle: { backgroundColor: theme.bg } }}
      tabBar={props => renderBar({ ...props, theme })}>
      <Tabs.Screen name="Home">{() => <HomeScreen theme={theme} />}</Tabs.Screen>
      <Tabs.Screen name="Tools">{() => <ToolsScreen theme={theme} />}</Tabs.Screen>
      <Tabs.Screen name="Scanner">{() => <ScannerScreen theme={theme} />}</Tabs.Screen>
      <Tabs.Screen name="Files">{() => <FilesScreen theme={theme} />}</Tabs.Screen>
      <Tabs.Screen name="Alerts">{() => <AlertsScreen theme={theme} />}</Tabs.Screen>
      <Tabs.Screen name="Settings">{() => <SettingsScreen theme={theme} />}</Tabs.Screen>
    </Tabs.Navigator>
    </View>
  );
}

export default function App() {
  const theme = useTheme();
  const { rtl } = useLang();
  useFestivalPrefetch();
  const [splash, setSplash] = useState(true);
  const done = useCallback(() => setSplash(false), []);
  const [navReady, setNavReady] = useState(false);
  const lastCheckin = useRef(0);
  const needsSetup = useNeedsOnboarding();
  const gate = useGate();
  useEffect(() => {
    // files, activity and the dark-mode choice saved on this phone; the Alerts history
    store.load().then(syncRtl);
    inbox.load();
    loadAds();
    // App Center settings (cached copy first, so the app works offline), then check in
    const every = () => (remote.get().config?.checkin_minutes ?? 30) * 60000;
    const checkin = () => {
      lastCheckin.current = Date.now();
      telemetry.checkin();
    };
    let timer: ReturnType<typeof setInterval> | null = null;
    const startTimer = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        refreshConfig(true).then(checkin);
      }, every());
    };
    remote
      .load()
      .then(() => {
        setAnalyticsEnabled(effectivePrefs().usage);
        return telemetry.load();
      })
      .then(() => refreshConfig(true))
      .then(() => {
        checkin();
        syncTopics();
        startTimer();
      });
    const stopPush = startPush();
    let lastResume = 0;
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        // app 1.2: coming back always checks the website (a 304 when nothing changed), so changes
        // made in App Center — force update, alerts, events — show without restarting the app
        const force = Date.now() - lastResume > 15000;
        lastResume = Date.now();
        inbox.takePending();
        refreshConfig(force).then(() => {
          if (Date.now() - lastCheckin.current >= every()) checkin();
          syncTopics();
        });
        startTimer();
      } else {
        // leaving the app (or it is being closed): write every pending save now
        flushAll();
        if (st === 'background') {
          if (timer) clearInterval(timer);
          timer = null;
          telemetry.flush(true);
        }
      }
    });
    return () => {
      sub.remove();
      stopPush();
      if (timer) clearInterval(timer);
    };
  }, []);
  // a notification tapped while the app was closed opens its screen once the app is ready
  useEffect(() => {
    if (navReady && !splash) onNavigationReady();
  }, [navReady, splash]);
  // Gallery → Share → Fileora: open the shared images, ready for an image tool
  useEffect(() => {
    if (!navReady || splash) return;
    const take = () =>
      native
        .takeSharedFiles()
        .then(list => {
          if (list.length && navigationRef.isReady())
            navigationRef.navigate('Shared', { files: list.map(f => ({ key: f.path, name: f.name, size: f.size, path: f.path, mime: f.mime })) });
        })
        .catch(e => Alert.alert('Couldn’t open the shared image', e instanceof Error ? e.message : String(e)));
    take();
    return native.onShare(take);
  }, [navReady, splash]);
  const navTheme = theme.dark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: theme.bg, card: theme.header, primary: theme.accent, border: theme.line, text: theme.ink } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.bg, card: theme.header, primary: theme.accent, border: theme.line, text: theme.ink } };

  return (
    <GestureHandlerRootView style={rootStyle}>
    <SafeAreaProvider>
      {/* Android 15+ draws edge to edge: the headers and the tab bar add the system bar insets themselves. */}
      <StatusBar barStyle={splash || theme.dark ? 'light-content' : 'dark-content'} />
      <MenuProvider>
        <ErrorBoundary>
          <View style={[styles.root, { backgroundColor: theme.bg, direction: rtl ? 'rtl' : 'ltr' }]}>
            <NavigationContainer
              ref={navigationRef}
              theme={navTheme}
              onReady={() => setNavReady(true)}
              onStateChange={() => {
                const r = navigationRef.getCurrentRoute();
                if (r) trackScreen(r.name);
              }}>
              {/* app 1.2: the iPhone's push animation on both platforms (parallax, smooth easing) */}
              <Stack.Navigator screenOptions={{ headerShown: false, animation: rtl ? 'ios_from_left' : 'ios_from_right', gestureEnabled: true, contentStyle: { backgroundColor: theme.bg } }}>
                <Stack.Screen name="Tabs">{() => <TabsScreen theme={theme} />}</Stack.Screen>
                <Stack.Screen name="Tool">{() => <ToolScreen theme={theme} />}</Stack.Screen>
                <Stack.Screen name="Process">{() => <ProcessScreen theme={theme} />}</Stack.Screen>
                <Stack.Screen name="Activity">{() => <ActivityScreen theme={theme} />}</Stack.Screen>
                <Stack.Screen name="ScanEditor" options={{ animation: 'fade' }}>
                  {() => <ScanEditorScreen theme={theme} />}
                </Stack.Screen>
                <Stack.Screen name="ScanDoc">{() => <ScanDocScreen theme={theme} />}</Stack.Screen>
                <Stack.Screen name="Shared">{() => <SharedScreen theme={theme} />}</Stack.Screen>
                <Stack.Screen name="RecycleBin">{() => <RecycleBinScreen theme={theme} />}</Stack.Screen>
                <Stack.Screen name="Cloud">{() => <CloudScreen theme={theme} />}</Stack.Screen>
                <Stack.Screen name="Blog">{() => <BlogScreen theme={theme} />}</Stack.Screen>
                <Stack.Screen name="Promo">{() => <PromoScreen theme={theme} />}</Stack.Screen>
                <Stack.Screen name="Alert">{() => <AlertDetailScreen theme={theme} />}</Stack.Screen>
                <Stack.Screen name="Web" options={{ animation: 'slide_from_bottom' }}>
                  {() => <WebScreen theme={theme} />}
                </Stack.Screen>
              </Stack.Navigator>
              <MenuSheet theme={theme} />
            </NavigationContainer>
            {!splash && needsSetup && !gate && <Onboarding theme={theme} />}
            <RemoteGate />
            {!splash && <FestivalOverlay />}
            <InAppBanner theme={theme} />
            <LanguageSheet theme={theme} />
            {/* the offline tool engine: an invisible page from the app's own files */}
            <EngineHost />
            <SelfTest />
            {splash && <SplashIntro onDone={done} />}
          </View>
        </ErrorBoundary>
      </MenuProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 }, flex: { flex: 1 } });

// pull to refresh (components/PullRefresh) needs the gesture handler's root view
const rootStyle = { flex: 1 };
