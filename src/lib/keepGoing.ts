/** "Keep going with this file": opens the next tool with the result already chosen when the app can. */
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { StackActions, useNavigation } from '@react-navigation/native';
import { isNative } from '../data/nativeTools';
import { isAvailable, toolById } from '../data/tools';
import { MAINTENANCE_MESSAGE, toolUrl } from '../config';
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
      if (!isAvailable(t)) {
        Alert.alert(t.name, MAINTENANCE_MESSAGE);
        return;
      }
      // the tool's page opens with the file already chosen
      store.logOpen(t.id);
      nav.dispatch(StackActions.push('Web', { url: toolUrl(t.slug), title: t.name, tool: t.id, inject: [{ path: f.path, name: f.name, mime: f.mime }] }));
    },
    [nav],
  );
}
