/**
 * The offline tool engine: the website's own tool code (pdf-lib, pdf.js, canvas), bundled in the
 * app and run in a hidden page (EngineHost). Nothing is downloaded and nothing is uploaded.
 *
 *   call(cmd, args)        → a command for the engine, resolves with its answer
 *   sendFile(path, …)      → copies a file into the engine in base64 pieces, returns its id
 *   readOutput(oid, …)     → writes one result from the engine to a file, piece by piece
 *   on(sid, fn)            → state / thumbnail / progress events of one open tool
 */
import BlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';
import { stripScheme } from '../store/files';

export const ENGINE_URL =
  Platform.OS === 'android' ? 'file:///android_asset/engine/index.html' : `file://${BlobUtil.fs.dirs.MainBundleDir}/engine/index.html`;
export const ENGINE_DIR = Platform.OS === 'android' ? 'file:///android_asset/engine/' : `file://${BlobUtil.fs.dirs.MainBundleDir}/engine/`;

const CHUNK_IN = 393216; // bytes per piece into the engine (a multiple of 3, so pieces encode without padding)
const CHUNK_OUT = 786432; // bytes per piece out of the engine

export type EngineEvent =
  | { ev: 'state'; sid: string; state: ToolState }
  | { ev: 'thumb'; sid: string; key: string; url: string }
  | { ev: 'progress'; sid: string; f: number; label: string };

export type OptField = {
  id: string;
  type: 'seg' | 'select' | 'text' | 'password' | 'textarea' | 'number' | 'range' | 'toggle' | 'color' | 'pos' | 'margins' | 'signature' | 'image' | 'note';
  label?: string;
  value?: unknown;
  choices?: [string, string][] | string[];
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  placeholder?: string;
  maxlength?: number;
  cells?: string[];
  custom?: boolean;
  text?: string;
  dyn?: boolean;
};
export type ToolDef = {
  id: string;
  name: string;
  accept: string;
  noun: string;
  nouns: string;
  exts: string[];
  kinds: string[];
  multi: boolean;
  min: number;
  max: number;
  ordered: boolean;
  camera: boolean;
  pages: boolean;
  cta: string;
  verb: string;
  tip: string;
  slots: string[] | null;
  dropText: string;
  server: boolean;
  passwords: boolean;
  regions: { multi: boolean; after: string } | null;
  code: boolean;
  textTitle: string;
  opts: OptField[];
};
export type Item = { id: string; fid: string; name: string; size: number; kind: string; pages: number | null; pw: number; ph: number; err: string; note: string; locked: boolean; meta: string; ready: boolean };
export type PageRef = { key: string; i: number; rot: number };
export type Region = { id: string; label?: string; x: number; y: number; w: number; h: number; ratio?: number };
export type PictureValue = { name: string; w: number; h: number; preview: string } | null;
export type ToolState = {
  sid: string;
  rev: number;
  opts: Record<string, unknown>;
  show: Record<string, boolean>;
  help: Record<string, string>;
  thumbStyle: string;
  items: Item[];
  pages: PageRef[] | null;
  pageCount: number;
  source: { w: number; h: number; err: string; loading: boolean; ready: boolean } | null;
  regions: Region[] | null;
  regionsSkip: boolean;
  regionsNote: string;
  ok: boolean;
  hint: string;
};
export type Output = { oid: string; name: string; size: number; type: string; note: string; good: boolean };
export type RunResult = {
  outputs?: Output[];
  result?: {
    title?: string;
    md?: string;
    text?: string;
    textNote?: string;
    diff?: { k: 'add' | 'del' | 'ctx'; p: number; t: string }[];
    add?: number;
    del?: number;
    a?: string;
    b?: string;
    palette?: { hex: string; pct: number }[];
  } | null;
  /* server tools: the app uploads the files itself */
  server?: boolean;
  options?: Record<string, unknown>;
  fids?: string[];
  url?: string;
  upload?: { oid: string; name: string; type: string; size: number }[];
  textTitle?: string;
};

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };
type Injector = (js: string) => void;

export class EngineError extends Error {
  user: boolean;
  constructor(message: string, user: boolean) {
    super(message);
    this.user = user;
  }
}

let inject: Injector | null = null;
let ready = false;
let tools: string[] = [];
let readyWaiters: { resolve: () => void; reject: (e: Error) => void }[] = [];
const pending = new Map<string, Pending>();
const listeners = new Map<string, Set<(e: EngineEvent) => void>>();
const resetListeners = new Set<() => void>();
let seq = 0;

/* ---- wiring, used by EngineHost ---- */
export function attach(fn: Injector) {
  inject = fn;
}
export function detach() {
  inject = null;
  ready = false;
}
/** The engine page reloaded or crashed: every running request fails, open tools must reopen. */
export function reset(reason: string) {
  ready = false;
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new EngineError(reason, true));
  }
  pending.clear();
  resetListeners.forEach(fn => fn());
}
export function receive(raw: string) {
  let m: { re?: string; ok?: boolean; data?: unknown; error?: string; user?: boolean; ev?: string; sid?: string; tools?: string[] };
  try {
    m = JSON.parse(raw);
  } catch {
    return;
  }
  if (m.re) {
    const p = pending.get(m.re);
    if (!p) return;
    pending.delete(m.re);
    clearTimeout(p.timer);
    if (m.ok) p.resolve(m.data);
    else p.reject(new EngineError(m.error || 'The tool stopped unexpectedly.', !!m.user || m.error === 'cancelled'));
    return;
  }
  if (m.ev === 'ready') {
    ready = true;
    tools = m.tools ?? [];
    readyWaiters.forEach(w => w.resolve());
    readyWaiters = [];
    return;
  }
  if (m.sid) listeners.get(m.sid)?.forEach(fn => fn(m as EngineEvent));
}

/* ---- use ---- */
export function isReady() {
  return ready;
}
export function engineTools() {
  return tools;
}
export function whenReady(ms = 20000): Promise<void> {
  if (ready) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const w = { resolve, reject };
    readyWaiters.push(w);
    setTimeout(() => {
      readyWaiters = readyWaiters.filter(x => x !== w);
      if (!ready) reject(new EngineError('The tool engine didn’t start. Close and reopen the app.', true));
    }, ms);
  });
}
export async function call<T = unknown>(cmd: string, args: Record<string, unknown> = {}, ms = 120000): Promise<T> {
  await whenReady();
  if (!inject) throw new EngineError('The tool engine isn’t running.', true);
  const id = `a${++seq}`;
  const msg = JSON.stringify({ ...args, id, cmd });
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new EngineError('The tool took too long to answer. Please try again.', true));
    }, ms);
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
    inject!(`window.FileoraApp&&FileoraApp.recv(${msg});true;`);
  });
}
export function on(sid: string, fn: (e: EngineEvent) => void): () => void {
  let set = listeners.get(sid);
  if (!set) listeners.set(sid, (set = new Set()));
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (!set!.size) listeners.delete(sid);
  };
}
/** Called when the engine page restarted: open tools must open their session again. */
export function onReset(fn: () => void): () => void {
  resetListeners.add(fn);
  return () => {
    resetListeners.delete(fn);
  };
}

/**
 * Copies a file into the engine. `stub` sends only the name and size (for files the engine
 * doesn't need to read, e.g. a Word file going to the server).
 */
export async function sendFile(path: string, name: string, mime: string, size: number, stub = false, onPart?: (f: number) => void): Promise<string> {
  const fid = `u${++seq}`;
  await call('fileBegin', { fid, name, type: mime, size, stub });
  if (!stub) {
    const p = stripScheme(path);
    const total = size || (await BlobUtil.fs.stat(p)).size || 1;
    const parts: string[] = [];
    let sent = 0;
    let failed: Error | null = null;
    // read in pieces; each piece is handed over in order and waits for the engine's answer
    const stream = await BlobUtil.fs.readStream(p, 'base64', CHUNK_IN, 10);
    let chain = Promise.resolve();
    await new Promise<void>((resolve, reject) => {
      stream.onData(chunk => {
        parts.push(String(chunk));
        chain = chain.then(async () => {
          const b64 = parts.shift();
          if (b64 === undefined || failed) return;
          await call('fileChunk', { fid, b64 });
          sent += (b64.length * 3) / 4;
          onPart?.(Math.min(1, sent / total));
        });
        chain.catch(e => (failed = e));
      });
      stream.onError(e => reject(new EngineError(`The file couldn’t be read: ${String(e)}`, true)));
      stream.onEnd(() => chain.then(resolve, reject));
      stream.open();
    });
    if (failed) throw failed;
  }
  await call('fileEnd', { fid });
  return fid;
}

/** Writes one engine result to `dest`. */
export async function readOutput(oid: string, size: number, dest: string, onPart?: (f: number) => void): Promise<string> {
  const part = `${dest}.part`;
  let start = 0;
  let first = true;
  if (size === 0) await BlobUtil.fs.writeFile(part, '', 'utf8');
  while (start < size) {
    const r = await call<{ b64: string; end: number; size: number }>('outRead', { oid, start, len: CHUNK_OUT });
    if (first) await BlobUtil.fs.writeFile(part, r.b64, 'base64');
    else await BlobUtil.fs.appendFile(part, r.b64, 'base64');
    first = false;
    start = r.end;
    onPart?.(Math.min(1, start / size));
  }
  if (await BlobUtil.fs.exists(dest)) await BlobUtil.fs.unlink(dest);
  await BlobUtil.fs.mv(part, dest);
  return dest;
}
