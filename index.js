/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Notifications that arrive while the app is closed are shown by Android itself; opening one is
// handled in src/remote/push.ts. FCM needs a background handler registered before the app starts.
try {
  setBackgroundMessageHandler(getMessaging(getApp()), async () => {});
} catch {
  // a build without Firebase configuration
}

AppRegistry.registerComponent(appName, () => App);
