/**
 * Alerts: the notification history, read/unread state and the unread count (bottom bar badge).
 *
 * Sources, merged by notification id (so one notification is never listed twice):
 *  1. The history App Center sends in app-config ("inbox"): every notification sent from WordPress
 *     in the last 30 days (App Center → Notifications → "Delete alerts after"), with the whole
 *     message. It comes from the website's database, not from what this phone received, so
 *     notifications sent while the phone was off, offline or had notifications muted are here too.
 *  2. Notifications this phone received while the app was open, or tapped.
 *  3. app 1.2: notifications that arrived while the app was in the background or closed
 *     (Android: saved by the background handler in index.js into inbox-pending.json, merged here).
 * Only notifications meant for this install are listed: its platform (filtered by the server), its
 * version ("only older versions") and the categories it keeps on.
 *
 * Read / unread (app 1.2): each alert is unread until it is opened (its detail screen), or until
 * "Mark all as read". A fresh install counts only the last 2 days as unread. Read state is kept on
 * this phone: the app has no accounts, so it can't follow a person to another phone.
 *
 * Alerts are deleted automatically after App Center's time, when an admin deletes them (one, or
 * Clear all), or by the person (one, or all with Undo). Saved in <data>/fileora/inbox.json.
 */
import { useSyncExternalStore } from 'react';
import { DATA, ensureDirs } from '../store/files';
import { onFlush, readJsonSafe, writeJsonSafe } from '../lib/safeFile';
import { APP_VERSION } from '../version';
import { cmpVersion, effectivePrefs, InboxItem, remote } from './remote';
import { alertKept } from './settingsLogic';
import BlobUtil from 'react-native-blob-util';

const FILE = `${DATA}/inbox.json`;
/** Written by the background notification handler (index.js) while the app isn't running. */
export const PENDING_FILE = `${DATA}/inbox-pending.json`;
const KEEP = 120; // items kept on the phone
const FRESH_DAYS = 2; // a new install counts only the last 2 days as unread
const READ_MAX = 500;

/**
 * received: alerts that arrived on this phone; read: ids opened one by one; readBefore: alerts up
 * to this time (seconds) count as read ("Mark all as read", and the starting point of a new install);
 * deleted: ids removed one by one; clearedAt: "Clear all" hides everything up to that time.
 */
type State = { loaded: boolean; received: InboxItem[]; read: string[]; readBefore: number; deleted: string[]; clearedAt: number };
let state: State = { loaded: false, received: [], read: [], readBefore: 0, deleted: [], clearedAt: 0 };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

const now = () => Math.floor(Date.now() / 1000);

function save() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!state.loaded) return Promise.resolve();
  return writeJsonSafe(FILE, {
    v: 2,
    received: state.received,
    read: state.read,
    readBefore: state.readBefore,
    deleted: state.deleted,
    clearedAt: state.clearedAt,
  });
}
onFlush(() => (timer ? save() : undefined));
function set(next: Partial<State>) {
  state = { ...state, ...next };
  cache = null;
  listeners.forEach(l => l());
  if (timer) clearTimeout(timer);
  timer = setTimeout(save, 300);
}

/** Whether a notification was meant for this install (version and categories). */
export function forMe(i: InboxItem, version = APP_VERSION, topics: Record<string, boolean> = effectivePrefs().topics): boolean {
  // "only installs older than the latest": hidden from this version and every newer one
  if (i.older && cmpVersion(version, i.older) >= 0) return false;
  if (!i.topic || i.topic === 'all') return true;
  return topics[i.topic] !== false;
}

let cache: { cfg: unknown; prefs: unknown; minute: number; out: InboxItem[] } | null = null;
const DEFAULT_HOURS = 720;
/** What App Center deleted, and how long alerts are kept. */
function purge() {
  const p = remote.get().config?.inbox_purge;
  return { hours: p?.hours ?? DEFAULT_HOURS, ids: p?.ids ?? [], before: p?.before ?? 0 };
}
/** Whether an alert is still kept (not too old, not deleted by an admin): see alertKept. */
function alive(i: InboxItem, pg: ReturnType<typeof purge>): boolean {
  return alertKept(i, now(), pg);
}

/**
 * Merges the phone's own copies with the website's history (pure: see __tests__/inbox.test.ts).
 * The website's copy wins for the text (it has the whole message; a notification carries at most
 * 300 characters), the phone's copy keeps the time it arrived.
 */
export function mergeInbox(received: InboxItem[], server: InboxItem[]): InboxItem[] {
  const byId = new Map<string, InboxItem>();
  for (const i of received) byId.set(i.id, i);
  for (const i of server) {
    const mine = byId.get(i.id);
    byId.set(i.id, { ...i, image: i.image || mine?.image || '', at: mine?.at ?? i.at });
  }
  return [...byId.values()];
}

/** The history, newest first, without what the person or an admin deleted, and nothing too old. */
export function inboxItems(): InboxItem[] {
  const s = remote.get();
  const minute = Math.floor(Date.now() / 60000); // alerts expire with time, not only with changes
  if (cache && cache.cfg === s.config && cache.prefs === s.prefs && cache.minute === minute) return cache.out;
  const pg = purge();
  const gone = new Set(state.deleted);
  const out = mergeInbox(state.received, s.config?.inbox ?? [])
    .filter(i => forMe(i) && !gone.has(i.id) && i.at > state.clearedAt && alive(i, pg))
    .sort((a, b) => b.at - a.at)
    .slice(0, KEEP);
  cache = { cfg: s.config, prefs: s.prefs, minute, out };
  return out;
}

export function isRead(i: InboxItem): boolean {
  return i.at <= state.readBefore || state.read.includes(i.id);
}

/** Removes expired and admin-deleted alerts from the phone's file too (at start and after each settings check). */
function prune() {
  if (!state.loaded) return;
  const pg = purge();
  const keep = state.received.filter(i => alive(i, pg));
  if (keep.length !== state.received.length) set({ received: keep });
}

function cleanItem(x: unknown): InboxItem | null {
  if (!x || typeof x !== 'object') return null;
  const i = x as Record<string, unknown>;
  const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  const id = s(i.id, 40);
  const title = s(i.title, 200);
  if (!id || !title) return null;
  return {
    id,
    title,
    body: s(i.body, 5000),
    image: /^https:\/\//i.test(s(i.image, 600)) ? s(i.image, 600) : '',
    open: s(i.open, 12) || 'home',
    tool: s(i.tool, 40),
    link: /^https:\/\//i.test(s(i.link, 600)) ? s(i.link, 600) : '',
    topic: s(i.topic, 20) || 'all',
    older: s(i.older, 16),
    at: Math.max(0, Number(i.at) || now()),
  };
}

type Saved = { v?: number; received?: unknown[]; read?: string[]; readBefore?: number; seenAt?: number; deleted?: string[]; clearedAt?: number };
let pruneHooked = false;

export const inbox = {
  async load() {
    if (state.loaded) return; // app 1.2.2: once per app run (see remote.load)
    const d = await readJsonSafe<Saved>(FILE).catch(() => null);
    state = {
      loaded: true,
      received: Array.isArray(d?.received) ? (d!.received.map(cleanItem).filter(Boolean) as InboxItem[]).slice(0, KEEP) : [],
      read: Array.isArray(d?.read) ? d!.read.filter(x => typeof x === 'string').slice(-READ_MAX) : [],
      // app 1.1 kept one "seen" time (opening Alerts marked everything read): it becomes the read-up-to time
      readBefore: Number(d?.readBefore) || Number(d?.seenAt) || now() - FRESH_DAYS * 86400,
      deleted: Array.isArray(d?.deleted) ? d!.deleted.filter(x => typeof x === 'string').slice(-300) : [],
      clearedAt: Number(d?.clearedAt) || 0,
    };
    cache = null;
    listeners.forEach(l => l());
    if (!d || d.v !== 2) set({}); // first run or app 1.1 file: save in the new format
    prune();
    await inbox.takePending();
    if (!pruneHooked) {
      pruneHooked = true;
      let lastCfg: unknown = remote.get().config;
      remote.subscribe(() => {
        const c = remote.get().config;
        if (c !== lastCfg) {
          lastCfg = c;
          prune();
        }
      });
    }
  },

  /** Adds notifications saved by the background handler while the app wasn't running (at start and on return). */
  async takePending() {
    if (!state.loaded) return;
    const list = await readJsonSafe<unknown[]>(PENDING_FILE).catch(() => null);
    if (!Array.isArray(list) || !list.length) return;
    await BlobUtil.fs.unlink(PENDING_FILE).catch(() => {});
    for (const x of list) {
      const i = cleanItem(x);
      if (i && !state.received.some(r => r.id === i.id)) inbox.add(i);
    }
  },

  /** A notification that arrived while the app was open (or was tapped). */
  add(i: Omit<InboxItem, 'at'> & { at?: number }) {
    if (!i.id || !i.title) return;
    const item: InboxItem = { ...i, at: i.at ?? now() };
    const rest = state.received.filter(x => x.id !== item.id);
    const old = state.received.find(x => x.id === item.id);
    // a notification that arrives again shows again, even if an older copy was deleted; it keeps its first time
    set({ received: [{ ...item, at: old?.at ?? item.at }, ...rest].slice(0, KEEP), deleted: state.deleted.filter(x => x !== item.id) });
  },

  /** Deletes one alert. */
  remove(id: string) {
    set({ deleted: [...state.deleted.filter(x => x !== id), id].slice(-300), received: state.received.filter(x => x.id !== id) });
  },

  /** Deletes every alert so far (one tap). Returns a function that undoes it. */
  clearAll(): () => void {
    const before = { deleted: state.deleted, clearedAt: state.clearedAt, received: state.received };
    const newest = Math.max(now(), ...inboxItems().map(i => i.at));
    set({ clearedAt: newest, received: [] });
    return () => set(before);
  },

  /** One alert was opened (its detail screen): it counts as read. */
  markRead(id: string) {
    if (state.read.includes(id)) return;
    set({ read: [...state.read, id].slice(-READ_MAX) });
  },

  /** "Mark all as read". Returns a function that undoes it. */
  markAllRead(): () => void {
    const before = { read: state.read, readBefore: state.readBefore };
    const newest = Math.max(now(), ...inboxItems().map(i => i.at));
    set({ readBefore: newest, read: [] });
    return () => set(before);
  },

  /** One alert, also one that was deleted or isn't in the list (for the detail screen). */
  find(id: string): InboxItem | null {
    return inboxItems().find(i => i.id === id) ?? mergeInbox(state.received, remote.get().config?.inbox ?? []).find(i => i.id === id) ?? null;
  },

  subscribe(l: () => void) {
    listeners.add(l);
    const off = remote.subscribe(l); // config (history) and categories change the list
    return () => {
      listeners.delete(l);
      off();
    };
  },
};

export function unreadCount(): number {
  if (!state.loaded) return 0;
  return inboxItems().filter(i => !isRead(i)).length;
}

export function useInbox(): InboxItem[] {
  return useSyncExternalStore(inbox.subscribe, inboxItems);
}

export function useUnread(): number {
  return useSyncExternalStore(inbox.subscribe, unreadCount);
}

/** Read state of one alert, re-rendered when it changes. */
export function useIsRead(i: InboxItem | null): boolean {
  return useSyncExternalStore(inbox.subscribe, () => (i ? isRead(i) : true));
}

/** Read ids snapshot (stable while nothing changes), for lists. */
export function useReadState(): { read: string[]; readBefore: number } {
  return useSyncExternalStore(inbox.subscribe, () => readSnap());
}
let snap: { read: string[]; readBefore: number } | null = null;
function readSnap() {
  if (!snap || snap.read !== state.read || snap.readBefore !== state.readBefore) snap = { read: state.read, readBefore: state.readBefore };
  return snap;
}

/**
 * Background handler (index.js): keeps a notification that arrived while the app wasn't running,
 * so it is in Alerts at the next start even before the settings are fetched. Small and safe to
 * run without the rest of the app.
 */
export async function savePendingPush(data: Record<string, string | undefined>, title?: string, body?: string, messageId?: string) {
  const t = title || data.title || '';
  if (!t) return;
  await ensureDirs().catch(() => {});
  const list = ((await readJsonSafe<unknown[]>(PENDING_FILE).catch(() => null)) ?? []).filter(Boolean);
  const id = String(data.id || messageId || Date.now()).slice(0, 40);
  if (list.some(x => (x as { id?: string }).id === id)) return;
  list.push({
    id,
    title: t.slice(0, 200),
    body: String(body || data.body || '').slice(0, 5000),
    image: data.image || '',
    open: data.open || 'home',
    tool: data.tool || '',
    link: data.link || '',
    topic: data.topic || 'all',
    older: '',
    at: Number(data.at) || Math.floor(Date.now() / 1000),
  });
  await writeJsonSafe(PENDING_FILE, list.slice(-50));
}
