/** Fileora's files split the way Home and Activity show them. */
import type { FileRec } from './store';

export function activityFiles(files: FileRec[]) {
  return {
    downloaded: files.filter(f => f.source === 'downloaded'),
    processed: files.filter(f => f.source === 'processed'),
    opened: files.filter(f => f.openedAt).sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0)),
  };
}
