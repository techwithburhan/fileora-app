/**
 * Fileora app – animated splash, 6 tabs (Home, Tools, Scanner, Files, Resume, Settings) + side menu,
 * native Merge / Watermark / Page numbers on the phone, server tools through the public fileora.in
 * API, a document scanner, and files and activity kept on this phone.
 *
 * Fileora → App Center (WordPress plugin) controls the app without a new APK: API tools, tool
 * status, maintenance, announcement, force update, links, popular tools (src/remote/remote.ts),
 * and sends push notifications through Firebase (src/remote/push.ts). Check-ins and anonymous
 * usage go to App Monitoring (src/remote/telemetry.ts).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
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
import ResumeScreen from './src/screens/ResumeScreen';
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
import { trackScreen } from './src/analytics';
import { Theme, useTheme } from './src/theme';
import RemoteGate from './src/components/RemoteGate';
import { remote } from './src/remote/remote';
import { telemetry } from './src/remote/telemetry';
import { onNavigationReady, startPush, syncTopics } from './src/remote/push';

/** Reads App Center settings; reports only real server answers as errors (not "offline"). */
async function refreshConfig(force = false) {
  const err = await remote.refresh(force);
  if (err && /HTTP|unexpected/.test(err)) telemetry.track('error', undefined, 0, err);
}

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function TabsScreen({ theme }: { theme: Theme }) {
  const renderBar = useCallback((props: React.ComponentProps<typeof AnimatedTabBar>) => <AnimatedTabBar {...props} theme={theme} />, [theme]);
  return (
    <Tabs.Navigator
      screenOptions={{ headerShown: false, animation: 'shift', sceneStyle: { backgroundColor: theme.bg } }}
      tabBar={props => renderBar({ ...props, theme })}>
      <Tabs.Screen name="Home">{() => <HomeScreen theme={theme} />}</Tabs.Screen>
      <Tabs.Screen name="Tools">{() => <ToolsScreen theme={theme} />}</Tabs.Screen>
      <Tabs.Screen name="Scanner">{() => <ScannerScreen theme={theme} />}</Tabs.Screen>
      <Tabs.Screen name="Files">{() => <FilesScreen theme={theme} />}</Tabs.Screen>
      <Tabs.Screen name="Resume">{() => <ResumeScreen theme={theme} />}</Tabs.Screen>
      <Tabs.Screen name="Settings">{() => <SettingsScreen theme={theme} />}</Tabs.Screen>
    </Tabs.Navigator>
  );
}

export default function App() {
  const theme = useTheme();
  const [splash, setSplash] = useState(true);
  const done = useCallback(() => setSplash(false), []);
  const [navReady, setNavReady] = useState(false);
  const lastCheckin = useRef(0);
  useEffect(() => {
    // files, activity and the dark-mode choice saved on this phone
    store.load();
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
      .then(() => telemetry.load())
      .then(() => refreshConfig(true))
      .then(() => {
        checkin();
        syncTopics();
        startTimer();
      });
    const stopPush = startPush();
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        refreshConfig().then(() => {
          if (Date.now() - lastCheckin.current >= every()) checkin();
          syncTopics();
        });
        startTimer();
      } else if (st === 'background') {
        if (timer) clearInterval(timer);
        timer = null;
        telemetry.flush(true);
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
    <SafeAreaProvider>
      {/* Android 15+ draws edge to edge: the headers and the tab bar add the system bar insets themselves. */}
      <StatusBar barStyle={splash || theme.dark ? 'light-content' : 'dark-content'} />
      <MenuProvider>
        <View style={[styles.root, { backgroundColor: theme.bg }]}>
          <NavigationContainer
            ref={navigationRef}
            theme={navTheme}
            onReady={() => setNavReady(true)}
            onStateChange={() => {
              const r = navigationRef.getCurrentRoute();
              if (r) trackScreen(r.name);
            }}>
            <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: theme.bg } }}>
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
              <Stack.Screen name="Web" options={{ animation: 'slide_from_bottom' }}>
                {() => <WebScreen theme={theme} />}
              </Stack.Screen>
            </Stack.Navigator>
            <MenuSheet theme={theme} />
          </NavigationContainer>
          <RemoteGate />
          {splash && <SplashIntro onDone={done} />}
        </View>
      </MenuProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
