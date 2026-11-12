/**
 * App state kept on this phone only (DocumentDir/fileora/state.json): Fileora's files, scan
 * documents, the Recycle Bin, the tool-usage history that drives Recently used / Popular / the
 * charts, cloud connections and settings. Nothing here is sent anywhere.
 */
import { useSyncExternalStore } from 'react';
import BlobUtil from 'react-native-blob-util';
import { DIRS, ensureDirs, ROOT, sizeOf, uniquePath } from './files';

/** downloaded/processed: tools · scan + scan-image: Scanned Images tab · convert: Convert PDFs tab */
export type Source = 'downloaded' | 'processed' | 'scan' | 'scan-image' | 'convert';
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
  /** scan document this page or PDF belongs to */
  docId?: string;
  /** Recycle Bin */
  trashedAt?: number;
  origPath?: string;
};
/** A scanned document (Scanned Images tab): its pages are image files, in order, plus an optional PDF. */
export type ScanDoc = { id: string; name: string; pageIds: string[]; pdfId?: string; createdAt: number; openedAt?: number; trashedAt?: number };
export type UsageEvent = { t: number; type: 'open' | 'done'; tool: string; bytes?: number };
export type ThemePref = 'system' | 'light' | 'dark';
export type CloudId = 'gdrive' | 'jiocloud' | 'onedrive';
type State = {
  v: 2;
  loaded: boolean;
  theme: ThemePref;
  files: FileRec[];
  docs: ScanDoc[];
  bin: FileRec[];
  binDocs: ScanDoc[];
  events: UsageEvent[];
  clouds: Partial<Record<CloudId, { connectedAt: number }>>;
};

const FILE = `${ROOT}/state.json`;
const TRASH = `${ROOT}/trash`;
const MAX_EVENTS = 1000;
let state: State = { v: 2, loaded: false, theme: 'system', files: [], docs: [], bin: [], binDocs: [], events: [], clouds: {} };
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach(l => l());
}
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { v, theme, files, docs, bin, binDocs, events, clouds } = state;
    const data = { v, theme, files, docs, bin, binDocs, events, clouds };
    BlobUtil.fs.writeFile(FILE, JSON.stringify(data), 'utf8').catch(() => {});
  }, 300);
}
function set(next: Partial<State>) {
  state = { ...state, ...next };
  emit();
  persist();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function existing(list: FileRec[] | undefined): Promise<FileRec[]> {
  const out: FileRec[] = [];
  for (const f of list ?? []) if (await BlobUtil.fs.exists(f.path)) out.push(f);
  return out;
}

/** Moves a file into the bin folder; returns the bin record. */
async function toBin(f: FileRec, now: number): Promise<FileRec> {
  if (!(await BlobUtil.fs.isDir(TRASH))) await BlobUtil.fs.mkdir(TRASH).catch(() => {});
  const path = `${TRASH}/${f.id}-${f.name}`;
  await BlobUtil.fs.mv(f.path, path).catch(() => {});
  return { ...f, path, origPath: f.path, trashedAt: now };
}
async function fromBin(f: FileRec): Promise<FileRec> {
  const orig = f.origPath ?? `${DIRS.processed}/${f.name}`;
  const dir = orig.slice(0, orig.lastIndexOf('/'));
  if (!(await BlobUtil.fs.isDir(dir))) await BlobUtil.fs.mkdir(dir).catch(() => {});
  const path = (await BlobUtil.fs.exists(orig)) ? await uniquePath(dir, f.name) : orig;
  await BlobUtil.fs.mv(f.path, path);
  const rest: FileRec = { ...f, path, name: path.slice(path.lastIndexOf('/') + 1) };
  delete rest.trashedAt;
  delete rest.origPath;
  return rest;
}

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
        const d = JSON.parse(await BlobUtil.fs.readFile(FILE, 'utf8')) as Partial<State> & { v?: number };
        // forget records whose file was removed outside the app
        let files = await existing(d.files);
        const bin = await existing(d.bin);
        let docs = (d.docs ?? []).map(doc => ({ ...doc, pageIds: doc.pageIds.filter(id => files.some(f => f.id === id)) }));
        if ((d.v ?? 1) < 2) {
          // 0.3: every scanned image was its own file, scanned PDFs had no document
          docs = [];
          files = files.map(f => {
            if (f.source === 'scan-image' && !f.docId) {
              const doc: ScanDoc = { id: uid(), name: f.name.replace(/\.[a-z]+$/i, ''), pageIds: [f.id], createdAt: f.createdAt };
              docs.push(doc);
              return { ...f, docId: doc.id };
            }
            return f.source === 'scan' && !f.docId ? { ...f, source: 'convert' as const } : f;
          });
        }
        state = {
          v: 2,
          loaded: true,
          theme: d.theme ?? 'system',
          files,
          docs: docs.filter(doc => doc.pageIds.length > 0),
          bin,
          binDocs: (d.binDocs ?? []).filter(doc => bin.some(f => f.docId === doc.id)),
          events: (d.events ?? []).slice(-MAX_EVENTS),
          clouds: d.clouds ?? {},
        };
        emit();
        if ((d.v ?? 1) < 2) persist();
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
  setCloud(id: CloudId, connected: boolean) {
    const clouds = { ...state.clouds };
    if (connected) clouds[id] = { connectedAt: Date.now() };
    else delete clouds[id];
    set({ clouds });
  },

  async addFile(f: Omit<FileRec, 'id' | 'createdAt' | 'size'> & { size?: number }): Promise<FileRec> {
    const rec: FileRec = { ...f, id: uid(), createdAt: Date.now(), size: f.size ?? (await sizeOf(f.path)) };
    set({ files: [rec, ...state.files] });
    return rec;
  },
  markOpened(id: string) {
    set({ files: state.files.map(f => (f.id === id ? { ...f, openedAt: Date.now() } : f)) });
  },

  /* ---------- scan documents ---------- */
  addDoc(d: { name: string; pageIds: string[]; pdfId?: string }): ScanDoc {
    const doc: ScanDoc = { id: uid(), createdAt: Date.now(), ...d };
    const ids = new Set([...d.pageIds, ...(d.pdfId ? [d.pdfId] : [])]);
    set({ docs: [doc, ...state.docs], files: state.files.map(f => (ids.has(f.id) ? { ...f, docId: doc.id } : f)) });
    return doc;
  },
  updateDoc(id: string, patch: Partial<Pick<ScanDoc, 'name' | 'pageIds' | 'pdfId' | 'openedAt'>>) {
    const ids = new Set([...(patch.pageIds ?? []), ...(patch.pdfId ? [patch.pdfId] : [])]);
    set({
      docs: state.docs.map(d => (d.id === id ? { ...d, ...patch } : d)),
      files: ids.size ? state.files.map(f => (ids.has(f.id) ? { ...f, docId: id } : f)) : state.files,
    });
  },

  /* ---------- Recycle Bin ---------- */
  /** Moves a file to the Recycle Bin (it can be restored). */
  async trashFile(id: string) {
    const f = state.files.find(x => x.id === id);
    if (!f) return;
    const binned = await toBin(f, Date.now());
    let docs = state.docs;
    let binDocs = state.binDocs;
    const bin = [binned, ...state.bin];
    if (f.docId) {
      docs = docs.map(d => (d.id === f.docId ? { ...d, pageIds: d.pageIds.filter(p => p !== id), pdfId: d.pdfId === id ? undefined : d.pdfId } : d));
      const doc = docs.find(d => d.id === f.docId);
      if (doc && doc.pageIds.length === 0) {
        // the last page went: the whole document goes to the bin (with its PDF)
        await store.trashDoc(doc.id, { files: state.files.filter(x => x.id !== id), bin, docs });
        return;
      }
    }
    set({ files: state.files.filter(x => x.id !== id), bin, docs, binDocs });
  },
  async trashDoc(docId: string, base?: { files: FileRec[]; bin: FileRec[]; docs: ScanDoc[] }) {
    const files0 = base?.files ?? state.files;
    const doc = (base?.docs ?? state.docs).find(d => d.id === docId);
    if (!doc) return;
    const now = Date.now();
    const mine = files0.filter(f => f.docId === docId);
    const binned: FileRec[] = [];
    for (const f of mine) binned.push(await toBin(f, now));
    set({
      files: files0.filter(f => f.docId !== docId),
      docs: (base?.docs ?? state.docs).filter(d => d.id !== docId),
      bin: [...binned, ...(base?.bin ?? state.bin)],
      binDocs: [{ ...doc, trashedAt: now }, ...state.binDocs],
    });
  },
  async restoreFile(id: string) {
    const f = state.bin.find(x => x.id === id);
    if (!f) return;
    const back = await fromBin(f);
    const liveDoc = back.docId ? state.docs.find(d => d.id === back.docId) : undefined;
    let docs = state.docs;
    if (liveDoc) {
      docs = docs.map(d =>
        d.id === liveDoc.id
          ? back.source === 'scan-image'
            ? { ...d, pageIds: [...d.pageIds, back.id] }
            : { ...d, pdfId: d.pdfId ?? back.id }
          : d,
      );
    }
    const rec = liveDoc || !back.docId ? back : { ...back, docId: undefined, source: back.source === 'scan' ? ('convert' as const) : back.source };
    if (!liveDoc && rec.source === 'scan-image') {
      // its document is gone: the page comes back as a one-page document
      const doc: ScanDoc = { id: uid(), name: rec.name.replace(/\.[a-z]+$/i, ''), pageIds: [rec.id], createdAt: Date.now() };
      set({ bin: state.bin.filter(x => x.id !== id), files: [{ ...rec, docId: doc.id }, ...state.files], docs: [doc, ...docs] });
      return;
    }
    set({ bin: state.bin.filter(x => x.id !== id), files: [rec, ...state.files], docs });
  },
  async restoreDoc(docId: string) {
    const doc = state.binDocs.find(d => d.id === docId);
    if (!doc) return;
    const restored: FileRec[] = [];
    for (const f of state.bin.filter(x => x.docId === docId)) restored.push(await fromBin(f).catch(() => f));
    const ok = restored.filter(f => !f.trashedAt);
    const live: ScanDoc = { ...doc };
    delete live.trashedAt;
    set({
      bin: state.bin.filter(x => x.docId !== docId),
      binDocs: state.binDocs.filter(d => d.id !== docId),
      files: [...ok, ...state.files],
      docs: [{ ...live, pageIds: live.pageIds.filter(p => ok.some(f => f.id === p)), pdfId: ok.some(f => f.id === live.pdfId) ? live.pdfId : undefined }, ...state.docs],
    });
  },
  async purgeFile(id: string) {
    const f = state.bin.find(x => x.id === id);
    if (f) await BlobUtil.fs.unlink(f.path).catch(() => {});
    set({ bin: state.bin.filter(x => x.id !== id) });
  },
  async purgeDoc(docId: string) {
    for (const f of state.bin.filter(x => x.docId === docId)) await BlobUtil.fs.unlink(f.path).catch(() => {});
    set({ bin: state.bin.filter(x => x.docId !== docId), binDocs: state.binDocs.filter(d => d.id !== docId) });
  },
  async emptyBin() {
    for (const f of state.bin) await BlobUtil.fs.unlink(f.path).catch(() => {});
    set({ bin: [], binDocs: [] });
  },

  /* ---------- usage ---------- */
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
