/**
 * Alerts: the notification history and its unread count (bottom bar badge).
 *
 * Two sources, merged by id: the history App Center sends in app-config ("inbox": the last 60
 * days of notifications sent from WordPress), and notifications this phone received while the
 * app was open (also those sent from the Firebase Console). Only notifications meant for this
 * install are listed: its platform (filtered by the server), its version ("only older versions")
 * and the categories it keeps on.
 *
 * "Unread" = newer than the last time the Alerts screen was opened. Opening it clears the badge.
 * Alerts are deleted automatically after 72 hours (App Center → Notifications → "Delete alerts
 * after"), when an admin deletes them (one, or Clear all), or by the person (one, or all with Undo).
 * Saved in DocumentDir/fileora/inbox.json.
 */
import { useSyncExternalStore } from 'react';
import { DATA } from '../store/files';
import { onFlush, readJsonSafe, writeJsonSafe } from '../lib/safeFile';
import { APP_VERSION } from '../version';
import { effectivePrefs, InboxItem, remote } from './remote';
import { alertKept } from './settingsLogic';

const FILE = `${DATA}/inbox.json`;
const KEEP = 60; // items kept on the phone
const FRESH_DAYS = 2; // a new install counts only the last 2 days as unread

/** deleted: ids removed one by one; clearedAt: "Clear all" hides everything up to that time (seconds) */
type State = { loaded: boolean; received: InboxItem[]; seenAt: number; deleted: string[]; clearedAt: number };
let state: State = { loaded: false, received: [], seenAt: 0, deleted: [], clearedAt: 0 };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

const now = () => Math.floor(Date.now() / 1000);

function save() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!state.loaded) return Promise.resolve();
  return writeJsonSafe(FILE, {
    received: state.received,
    seenAt: state.seenAt,
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
function forMe(i: InboxItem): boolean {
  if (i.older && i.older === APP_VERSION) return false; // "only installs older than the latest"
  if (!i.topic || i.topic === 'all') return true;
  return effectivePrefs().topics[i.topic] !== false;
}

let cache: { cfg: unknown; prefs: unknown; minute: number; out: InboxItem[] } | null = null;
const DEFAULT_HOURS = 72;
/** What App Center deleted, and how long alerts are kept. */
function purge() {
  const p = remote.get().config?.inbox_purge;
  return { hours: p?.hours ?? DEFAULT_HOURS, ids: p?.ids ?? [], before: p?.before ?? 0 };
}
/** Whether an alert is still kept (not too old, not deleted by an admin): see alertKept. */
function alive(i: InboxItem, pg: ReturnType<typeof purge>): boolean {
  return alertKept(i, now(), pg);
}

/** The history, newest first, without what the person or an admin deleted, and nothing older than 72 hours. */
export function inboxItems(): InboxItem[] {
  const s = remote.get();
  const minute = Math.floor(Date.now() / 60000); // alerts expire with time, not only with changes
  if (cache && cache.cfg === s.config && cache.prefs === s.prefs && cache.minute === minute) return cache.out;
  const pg = purge();
  const gone = new Set(state.deleted);
  const byId = new Map<string, InboxItem>();
  for (const i of state.received) byId.set(i.id, i);
  for (const i of s.config?.inbox ?? []) byId.set(i.id, { ...i, at: byId.get(i.id)?.at ?? i.at }); // server copy, first time seen
  const out = [...byId.values()]
    .filter(i => forMe(i) && !gone.has(i.id) && i.at > state.clearedAt && alive(i, pg))
    .sort((a, b) => b.at - a.at)
    .slice(0, KEEP);
  cache = { cfg: s.config, prefs: s.prefs, minute, out };
  return out;
}

/** Removes expired and admin-deleted alerts from the phone's file too (at start and after each settings check). */
function prune() {
  if (!state.loaded) return;
  const pg = purge();
  const keep = state.received.filter(i => alive(i, pg));
  if (keep.length !== state.received.length) set({ received: keep });
}

type Saved = { received?: InboxItem[]; seenAt?: number; deleted?: string[]; clearedAt?: number };
let pruneHooked = false;

export const inbox = {
  async load() {
    const d = await readJsonSafe<Saved>(FILE).catch(() => null);
    state = {
      loaded: true,
      received: Array.isArray(d?.received) ? d!.received.filter(i => i && typeof i.id === 'string').slice(0, KEEP) : [],
      seenAt: Number(d?.seenAt) || now() - FRESH_DAYS * 86400,
      deleted: Array.isArray(d?.deleted) ? d!.deleted.filter(x => typeof x === 'string').slice(-300) : [],
      clearedAt: Number(d?.clearedAt) || 0,
    };
    cache = null;
    listeners.forEach(l => l());
    if (!d) set({}); // first run: remember the starting point
    prune();
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

  /** A notification that arrived while the app was open (or was tapped). */
  add(i: Omit<InboxItem, 'at'> & { at?: number }) {
    if (!i.id || !i.title) return;
    const item: InboxItem = { ...i, at: i.at ?? now() };
    const rest = state.received.filter(x => x.id !== item.id);
    // a notification that arrives again shows again, even if an older copy was deleted
    set({ received: [item, ...rest].slice(0, KEEP), deleted: state.deleted.filter(x => x !== item.id) });
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

  /** The Alerts screen was opened: everything so far counts as read. */
  markSeen() {
    const newest = Math.max(now(), ...inboxItems().map(i => i.at));
    if (newest > state.seenAt) set({ seenAt: newest });
  },

  seenAt: () => state.seenAt,

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
  return inboxItems().filter(i => i.at > state.seenAt).length;
}

export function useInbox(): InboxItem[] {
  return useSyncExternalStore(inbox.subscribe, inboxItems);
}

export function useUnread(): number {
  return useSyncExternalStore(inbox.subscribe, unreadCount);
}
