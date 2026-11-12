/**
 * Fileora app – animated splash, 6 tabs (Home, Tools, Scanner, Files, Resume, Settings) + side menu,
 * native Merge / Watermark / Page numbers on the phone, server tools through the public fileora.in
 * API, a document scanner, and files and activity kept on this phone.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
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
import ScanReviewScreen from './src/screens/ScanReviewScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ToolScreen from './src/screens/ToolScreen';
import ToolsScreen from './src/screens/ToolsScreen';
import WebScreen from './src/screens/WebScreen';
import { store } from './src/store/store';
import { navigationRef, RootStackParamList, TabParamList } from './src/navigation/types';
import { trackScreen } from './src/analytics';
import { Theme, useTheme } from './src/theme';

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
  useEffect(() => {
    // files, activity and the dark-mode choice saved on this phone
    store.load();
  }, []);
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
            onStateChange={() => {
              const r = navigationRef.getCurrentRoute();
              if (r) trackScreen(r.name);
            }}>
            <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: theme.bg } }}>
              <Stack.Screen name="Tabs">{() => <TabsScreen theme={theme} />}</Stack.Screen>
              <Stack.Screen name="Tool">{() => <ToolScreen theme={theme} />}</Stack.Screen>
              <Stack.Screen name="Process">{() => <ProcessScreen theme={theme} />}</Stack.Screen>
              <Stack.Screen name="Activity">{() => <ActivityScreen theme={theme} />}</Stack.Screen>
              <Stack.Screen name="ScanReview">{() => <ScanReviewScreen theme={theme} />}</Stack.Screen>
              <Stack.Screen name="Blog">{() => <BlogScreen theme={theme} />}</Stack.Screen>
              <Stack.Screen name="Web" options={{ animation: 'slide_from_bottom' }}>
                {() => <WebScreen theme={theme} />}
              </Stack.Screen>
            </Stack.Navigator>
            <MenuSheet theme={theme} />
          </NavigationContainer>
          {splash && <SplashIntro onDone={done} />}
        </View>
      </MenuProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
