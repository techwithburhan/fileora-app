/**
 * Whether the app is in the middle of a task (processing a file, saving a scan, a download).
 * Maintenance mode and force update wait until the task has finished instead of covering the
 * app halfway through it.
 */
import { useSyncExternalStore } from 'react';

let count = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const busy = {
  start() {
    count++;
    emit();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      count = Math.max(0, count - 1);
      emit();
    };
  },
  get: () => count > 0,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useBusy(): boolean {
  return useSyncExternalStore(busy.subscribe, busy.get);
}
