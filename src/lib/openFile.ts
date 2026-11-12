import { Alert } from 'react-native';
import { openWithViewer } from '../store/files';
import { FileRec, store } from '../store/store';

/** Opens a Fileora file with the phone's viewer and records it under "Opened". */
export function openRecord(f: FileRec) {
  store.markOpened(f.id);
  openWithViewer(f.path, f.mime).catch(() => Alert.alert('Can’t open this file', 'No app on this phone can open this file type.'));
}

export function confirmDelete(f: FileRec, what = 'file', onDone?: () => void) {
  Alert.alert(`Delete this ${what}?`, `“${f.name}” will be removed from Fileora. The copy in Downloads/Fileora stays.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        store.removeFile(f.id).then(() => onDone?.());
      },
    },
  ]);
}

/** The scanner's confirmation before an image is thrown away. */
export function confirmDiscard(onDiscard: () => void) {
  Alert.alert('Discard image?', 'Are you sure you want to discard this image?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: onDiscard },
  ]);
}
