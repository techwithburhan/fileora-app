/**
 * App state kept on this phone only (DocumentDir/fileora/state.json): Fileora's files, the
 * tool-usage history that drives Recently used / Popular / the charts, and settings.
 * Nothing here is sent anywhere.
 */
import { useSyncExternalStore } from 'react';
import BlobUtil from 'react-native-blob-util';
import { ensureDirs, ROOT, sizeOf } from './files';

export type Source = 'downloaded' | 'processed' | 'scan' | 'scan-image';
export type FileRec = {
  id: string;
  name: string;
  mime: string;
  size: number;
  path: string;
  source: Source;
  tool?: string;
  pages?: number;
  createdAt: number;
  openedAt?: number;
};
export type UsageEvent = { t: number; type: 'open' | 'done'; tool: string; bytes?: number };
export type ThemePref = 'system' | 'light' | 'dark';
type State = { v: 1; loaded: boolean; theme: ThemePref; files: FileRec[]; events: UsageEvent[] };

const FILE = `${ROOT}/state.json`;
const MAX_EVENTS = 1000;
let state: State = { v: 1, loaded: false, theme: 'system', files: [], events: [] };
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach(l => l());
}
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data = { v: state.v, theme: state.theme, files: state.files, events: state.events };
    BlobUtil.fs.writeFile(FILE, JSON.stringify(data), 'utf8').catch(() => {});
  }, 300);
}
function set(next: Partial<State>) {
  state = { ...state, ...next };
  emit();
  persist();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  async load() {
    await ensureDirs();
    try {
      if (await BlobUtil.fs.exists(FILE)) {
        const d = JSON.parse(await BlobUtil.fs.readFile(FILE, 'utf8')) as Partial<State>;
        // forget records whose file was removed outside the app
        const files: FileRec[] = [];
        for (const f of d.files ?? []) if (await BlobUtil.fs.exists(f.path)) files.push(f);
        state = { v: 1, loaded: true, theme: d.theme ?? 'system', files, events: (d.events ?? []).slice(-MAX_EVENTS) };
        emit();
        return;
      }
    } catch {
      // damaged file: start fresh (files on disk stay)
    }
    state = { ...state, loaded: true };
    emit();
  },

  setTheme(theme: ThemePref) {
    set({ theme });
  },

  async addFile(f: Omit<FileRec, 'id' | 'createdAt' | 'size'> & { size?: number }): Promise<FileRec> {
    const rec: FileRec = { ...f, id: uid(), createdAt: Date.now(), size: f.size ?? (await sizeOf(f.path)) };
    set({ files: [rec, ...state.files] });
    return rec;
  },
  markOpened(id: string) {
    set({ files: state.files.map(f => (f.id === id ? { ...f, openedAt: Date.now() } : f)) });
  },
  async removeFile(id: string) {
    const f = state.files.find(x => x.id === id);
    if (f) await BlobUtil.fs.unlink(f.path).catch(() => {});
    set({ files: state.files.filter(x => x.id !== id) });
  },

  logOpen(tool: string) {
    set({ events: [...state.events, { t: Date.now(), type: 'open' as const, tool }].slice(-MAX_EVENTS) });
  },
  logDone(tool: string, bytes: number) {
    set({ events: [...state.events, { t: Date.now(), type: 'done' as const, tool, bytes }].slice(-MAX_EVENTS) });
  },
};

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(state));
}
