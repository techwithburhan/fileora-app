/**
 * Alerts: the notification history and its unread count (bottom bar badge).
 *
 * Two sources, merged by id: the history App Center sends in app-config ("inbox": the last 60
 * days of notifications sent from WordPress), and notifications this phone received while the
 * app was open (also those sent from the Firebase Console). Only notifications meant for this
 * install are listed: its platform (filtered by the server), its version ("only older versions")
 * and the categories it keeps on.
 *
 * "Unread" = newer than the last time the Alerts screen was opened. Opening it clears the badge;
 * the history stays. Saved in DocumentDir/fileora/inbox.json.
 */
import { useSyncExternalStore } from 'react';
import { DATA } from '../store/files';
import { onFlush, readJsonSafe, writeJsonSafe } from '../lib/safeFile';
import { APP_VERSION } from '../version';
import { effectivePrefs, InboxItem, remote } from './remote';

const FILE = `${DATA}/inbox.json`;
const KEEP = 60; // items kept on the phone
const FRESH_DAYS = 2; // a new install counts only the last 2 days as unread

type State = { loaded: boolean; received: InboxItem[]; seenAt: number };
let state: State = { loaded: false, received: [], seenAt: 0 };
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

let cache: { cfg: unknown; prefs: unknown; out: InboxItem[] } | null = null;
/** The history, newest first. */
export function inboxItems(): InboxItem[] {
  const s = remote.get();
  if (cache && cache.cfg === s.config && cache.prefs === s.prefs)
    return cache.out;
  const byId = new Map<string, InboxItem>();
  for (const i of state.received) byId.set(i.id, i);
  for (const i of s.config?.inbox ?? [])
    byId.set(i.id, { ...i, at: byId.get(i.id)?.at ?? i.at }); // server copy, first time seen
  const out = [...byId.values()]
    .filter(forMe)
    .sort((a, b) => b.at - a.at)
    .slice(0, KEEP);
  cache = { cfg: s.config, prefs: s.prefs, out };
  return out;
}

export const inbox = {
  async load() {
    const d = await readJsonSafe<{ received?: InboxItem[]; seenAt?: number }>(
      FILE,
    ).catch(() => null);
    state = {
      loaded: true,
      received: Array.isArray(d?.received)
        ? d!.received.filter(i => i && typeof i.id === 'string').slice(0, KEEP)
        : [],
      seenAt: Number(d?.seenAt) || now() - FRESH_DAYS * 86400,
    };
    cache = null;
    listeners.forEach(l => l());
    if (!d) set({}); // first run: remember the starting point
  },

  /** A notification that arrived while the app was open (or was tapped). */
  add(i: Omit<InboxItem, 'at'> & { at?: number }) {
    if (!i.id || !i.title) return;
    const item: InboxItem = { ...i, at: i.at ?? now() };
    const rest = state.received.filter(x => x.id !== item.id);
    set({ received: [item, ...rest].slice(0, KEEP) });
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
