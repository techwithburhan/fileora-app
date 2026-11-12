/** "Keep going with this file": opens the next tool with the result already chosen when the app can. */
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { StackActions, useNavigation } from '@react-navigation/native';
import { isNative } from '../data/nativeTools';
import { toolById } from '../data/tools';
import { toolUrl } from '../config';
import { FileRec, store } from '../store/store';

export function useKeepGoing() {
  const nav = useNavigation();
  return useCallback(
    (toolId: string, f: FileRec) => {
      if (isNative(toolId)) {
        nav.dispatch(StackActions.push('Process', { tool: toolId, fileIds: [f.id] }));
        return;
      }
      const t = toolById(toolId);
      if (!t) return;
      Alert.alert(t.name, `${t.name} opens on the Fileora page. Choose “${f.name}” there: it is in Downloads/Fileora.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open',
          onPress: () => {
            store.logOpen(t.id);
            nav.dispatch(StackActions.push('Web', { url: toolUrl(t.slug), title: t.name, tool: t.id }));
          },
        },
      ]);
    },
    [nav],
  );
}
