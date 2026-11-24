/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { savePendingPush } from './src/remote/inbox';
import { name as appName } from './app.json';

// Notifications that arrive while the app is in the background or closed are shown by the system;
// opening one is handled in src/remote/push.ts. App 1.2: the handler also keeps a copy for Alerts,
// so it is listed at the next start even before the settings are fetched (src/remote/inbox.ts).
try {
  setBackgroundMessageHandler(getMessaging(getApp()), async msg => {
    try {
      await savePendingPush(msg.data || {}, msg.notification?.title, msg.notification?.body, msg.messageId);
    } catch {
      // never let a storage problem affect the notification itself
    }
  });
} catch {
  // a build without Firebase configuration
}

AppRegistry.registerComponent(appName, () => App);
