import Alert from '../i18n/Alert';
import { openWithViewer } from '../store/files';
import { native } from './native';
import { FileRec, ScanDoc, store } from '../store/store';
import { tr } from '../i18n/i18n';

/** Opens a Fileora file with the phone's viewer and records it under "Opened". */
export function openRecord(f: FileRec) {
  store.markOpened(f.id);
  openWithViewer(f.path, f.mime).catch(() => Alert.alert('Can’t open this file', 'No app on this phone can open this file type.'));
}

/** Deleting moves the file to the Recycle Bin (Files → Recycle Bin), where it can be restored. */
export function confirmDelete(f: FileRec, what = 'file', onDone?: () => void) {
  Alert.alert(tr(what === 'PDF' ? 'Delete this PDF?' : what === 'page' ? 'Delete this page?' : 'Delete this file?'), tr('“{name}” moves to the Recycle Bin. You can restore it from Files → Recycle Bin.', { name: f.name }), [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        store.trashFile(f.id).then(() => onDone?.());
      },
    },
  ]);
}

/** Moves a scanned document (pages and PDF) to the Recycle Bin. */
export function confirmDeleteDoc(doc: ScanDoc, onDone?: () => void) {
  Alert.alert('Delete this document?', tr('“{name}” and its pages move to the Recycle Bin. You can restore them from Files → Recycle Bin.', { name: doc.name }), [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => store.trashDoc(doc.id).then(() => onDone?.()) },
  ]);
}

/** "Clear all" in a Scanner tab: everything listed there goes to the Recycle Bin. */
export function confirmClearAll(what: string, n: number, onClear: () => void) {
  Alert.alert(tr('Clear all {what}?', { what: tr(what) }), tr(n === 1 ? '1 item moves to the Recycle Bin. You can restore it from Files → Recycle Bin.' : '{n} items move to the Recycle Bin. You can restore them from Files → Recycle Bin.', { n }), [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear all', style: 'destructive', onPress: onClear },
  ]);
}

/** Sends a file to another app with Android's share sheet (WhatsApp, Drive, email…). */
export function shareRecord(f: FileRec) {
  native.shareToApp(f.path, f.mime, '').catch(e => Alert.alert('Couldn’t share', e instanceof Error ? e.message : String(e)));
}

/** The scanner's confirmation before an image is thrown away. */
export function confirmDiscard(onDiscard: () => void, count = 1) {
  const many = count > 1;
  Alert.alert(many ? 'Discard images?' : 'Discard image?', many ? tr('Are you sure you want to discard these {n} images?', { n: count }) : 'Are you sure you want to discard this image?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: onDiscard },
  ]);
}
