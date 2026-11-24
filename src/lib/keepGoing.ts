/** "Keep going with this file": opens the next tool's screen with the result already chosen. */
import { useCallback } from 'react';
import Alert from '../i18n/Alert';
import { StackActions, useNavigation } from '@react-navigation/native';
import { isNative } from '../data/nativeTools';
import { isAvailable, toolById, toolState } from '../data/tools';
import { maintenanceMessage, soonMessage } from '../remote/remote';
import { FileRec } from '../store/store';

export function useKeepGoing() {
  const nav = useNavigation();
  return useCallback(
    (toolId: string, f: FileRec) => {
      const t = toolById(toolId);
      if (!t) return;
      if (!isAvailable(t) || !isNative(toolId)) {
        Alert.alert(t.name, toolState(t) === 'soon' ? soonMessage() : maintenanceMessage());
        return;
      }
      // the tool's own screen opens with the file already chosen
      nav.dispatch(StackActions.push('Process', { tool: toolId, fileIds: [f.id] }));
    },
    [nav],
  );
}
