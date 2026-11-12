/** ⋮ menu for a Fileora file: open, share, upload to a connected cloud, delete (to the Recycle Bin). */
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import ActionSheet, { SheetAction } from './ActionSheet';
import { CLOUDS } from '../data/clouds';
import { native } from '../lib/native';
import { confirmDelete, openRecord, shareRecord } from '../lib/openFile';
import { FileRec, store } from '../store/store';
import { Theme } from '../theme';

export function useFileActions(theme: Theme): [(f: FileRec) => void, React.ReactElement] {
  const [file, setFile] = useState<FileRec | null>(null);
  const show = useCallback((f: FileRec) => setFile(f), []);
  const clouds = CLOUDS.filter(c => store.get().clouds[c.id]);
  const actions: SheetAction[] | null = file
    ? [
        { key: 'open', label: 'Open', icon: 'external', onPress: () => openRecord(file) },
        { key: 'share', label: 'Share', sub: 'WhatsApp, email, Bluetooth…', icon: 'share', onPress: () => shareRecord(file) },
        ...clouds.map(c => ({
          key: c.id,
          label: `Upload to ${c.name}`,
          icon: 'cloud' as const,
          onPress: () => native.shareToApp(file.path, file.mime, c.pkg).catch(e => Alert.alert(c.name, e instanceof Error ? e.message : String(e))),
        })),
        { key: 'del', label: 'Delete', sub: 'Moves to the Recycle Bin', icon: 'trash', danger: true, onPress: () => confirmDelete(file) },
      ]
    : null;
  return [show, <ActionSheet key="file-actions" title={file?.name} actions={actions} theme={theme} onClose={() => setFile(null)} />];
}
