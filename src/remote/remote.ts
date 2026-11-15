/**
 * Settings managed from WordPress (Fileora → App Center), read from the public endpoint
 * /wp-json/fileora/v1/app-config: API tools on/off, maintenance, per-tool status, banner,
 * force update, links, popular tools. Cached on the phone so the app works offline.
 *
 * Also keeps this install's own preferences: notifications, anonymous usage, dismissed banners,
 * and the random install ID used for check-ins. Saved in DocumentDir/fileora/remote.json.
 */
import { useSyncExternalStore } from 'react';
import BlobUtil from 'react-native-blob-util';
import { API_TOOLS_LIVE, MAINTENANCE_MESSAGE, SITE } from '../config';
import { ensureDirs, ROOT } from '../store/files';

export type ToolFlag = 'soon' | 'off';
export type RemoteConfig = {
  v: number;
  api_live: boolean;
  api_tools: string[];
  maintenance_msg: string;
  soon_msg: string;
  tools: Record<string, ToolFlag>;
  site_off: string[];
  app_maintenance: { title: string; text: string } | null;
  announcement: { id: string; style: 'info' | 'offer' | 'warning'; title: string; text: string; button: string; link: string } | null;
  update: { latest: string; min: string; url: string; notes: string };
  links: { terms: string; privacy: string; contact: string; share: string; share_text: string };
  popular: string[];
  tracking: boolean;
  checkin_minutes: number;
  cache_seconds: number;
  topics: string[];
};
/** Notification categories people can switch off (FCM topics). "all" = important, always on. */
export const TOPIC_LABELS: { id: string; label: string }[] = [
  { id: 'updates', label: 'New app versions' },
  { id: 'news', label: 'Daily updates & news' },
  { id: 'tools', label: 'New tools' },
  { id: 'offers', label: 'Offers' },
  { id: 'blog', label: 'Blog posts' },
];
export type Prefs = {
  notify: boolean; // the person wants notifications
  topics: Record<string, boolean>;
  askedAt: number; // when we last asked about notifications (0 = never)
  usage: boolean; // share anonymous usage
};
type State = {
  loaded: boolean;
  config: RemoteConfig | null;
  fetchedAt: number;
  install: string;
  prefs: Prefs;
  dismissed: { ann?: string; update?: string };
  subscribed: string[]; // FCM topics this install is subscribed to
};

const FILE = `${ROOT}/remote.json`;
export const CONFIG_URL = `${SITE}/wp-json/fileora/v1/app-config?platform=android`;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function randomId() {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 16; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

let state: State = {
  loaded: false,
  config: null,
  fetchedAt: 0,
  install: '',
  prefs: { notify: true, topics: Object.fromEntries(TOPIC_LABELS.map(t => [t.id, true])), askedAt: 0, usage: true },
  dismissed: {},
  subscribed: [],
};

function emit() {
  listeners.forEach(l => l());
}
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { config, fetchedAt, install, prefs, dismissed, subscribed } = state;
    BlobUtil.fs.writeFile(FILE, JSON.stringify({ config, fetchedAt, install, prefs, dismissed, subscribed }), 'utf8').catch(() => {});
  }, 300);
}
function set(next: Partial<State>) {
  state = { ...state, ...next };
  emit();
  persist();
}

/** Accepts only what the app understands, so a bad answer can't break it. */
function clean(j: unknown): RemoteConfig | null {
  if (!j || typeof j !== 'object' || (j as { v?: unknown }).v !== 1) return null;
  const c = j as Partial<RemoteConfig>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const tools: Record<string, ToolFlag> = {};
  if (c.tools && typeof c.tools === 'object') for (const [k, v] of Object.entries(c.tools)) if (v === 'soon' || v === 'off') tools[k] = v;
  const ann = c.announcement && typeof c.announcement === 'object' && str(c.announcement.title) ? c.announcement : null;
  return {
    v: 1,
    api_live: c.api_live === true,
    api_tools: arr(c.api_tools),
    maintenance_msg: str(c.maintenance_msg) || MAINTENANCE_MESSAGE,
    soon_msg: str(c.soon_msg) || 'This tool is coming soon.',
    tools,
    site_off: arr(c.site_off),
    app_maintenance: c.app_maintenance && typeof c.app_maintenance === 'object' ? { title: str(c.app_maintenance.title), text: str(c.app_maintenance.text) } : null,
    announcement: ann
      ? { id: str(ann.id), style: ann.style === 'offer' || ann.style === 'warning' ? ann.style : 'info', title: str(ann.title), text: str(ann.text), button: str(ann.button), link: str(ann.link) }
      : null,
    update: { latest: str(c.update?.latest), min: str(c.update?.min), url: str(c.update?.url), notes: str(c.update?.notes) },
    links: { terms: str(c.links?.terms), privacy: str(c.links?.privacy), contact: str(c.links?.contact), share: str(c.links?.share) || SITE, share_text: str(c.links?.share_text) },
    popular: arr(c.popular),
    tracking: c.tracking !== false,
    checkin_minutes: Math.max(5, Math.min(1440, Number(c.checkin_minutes) || 30)),
    cache_seconds: Math.max(0, Math.min(3600, Number(c.cache_seconds) || 60)),
    topics: arr(c.topics),
  };
}

export const remote = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  async load() {
    await ensureDirs();
    try {
      if (await BlobUtil.fs.exists(FILE)) {
        const d = JSON.parse(await BlobUtil.fs.readFile(FILE, 'utf8'));
        state = {
          ...state,
          config: clean(d.config),
          fetchedAt: Number(d.fetchedAt) || 0,
          install: typeof d.install === 'string' && /^[a-z0-9]{16}$/.test(d.install) ? d.install : '',
          prefs: { ...state.prefs, ...(d.prefs || {}), topics: { ...state.prefs.topics, ...(d.prefs?.topics || {}) } },
          dismissed: d.dismissed || {},
          subscribed: Array.isArray(d.subscribed) ? d.subscribed : [],
        };
      }
    } catch {
      // damaged file: defaults
    }
    if (!state.install) state.install = randomId();
    state = { ...state, loaded: true };
    emit();
    persist();
  },

  /** Fetches the settings (respecting the cache time unless forced). Returns an error text or null. */
  async refresh(force = false): Promise<string | null> {
    const c = state.config;
    if (!force && c && Date.now() - state.fetchedAt < c.cache_seconds * 1000) return null;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(CONFIG_URL, { headers: { Accept: 'application/json' }, signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) return `config: HTTP ${r.status}`;
      const cfg = clean(await r.json());
      if (!cfg) return 'config: unexpected answer';
      set({ config: cfg, fetchedAt: Date.now() });
      return null;
    } catch (e) {
      return `config: ${e instanceof Error ? (e.name === 'AbortError' ? 'timeout' : e.message) : 'failed'}`;
    }
  },

  setPrefs(p: Partial<Prefs>) {
    set({ prefs: { ...state.prefs, ...p } });
  },
  setTopic(id: string, on: boolean) {
    set({ prefs: { ...state.prefs, topics: { ...state.prefs.topics, [id]: on } } });
  },
  dismiss(kind: 'ann' | 'update', id: string) {
    set({ dismissed: { ...state.dismissed, [kind]: id } });
  },
  setSubscribed(list: string[]) {
    set({ subscribed: list });
  },
};

export function useRemote<T>(select: (s: State) => T): T {
  return useSyncExternalStore(remote.subscribe, () => select(state));
}

/* ---------- helpers used across the app ---------- */

export function apiLive(): boolean {
  return state.config ? state.config.api_live : API_TOOLS_LIVE;
}
export function maintenanceMessage(): string {
  return state.config?.maintenance_msg || MAINTENANCE_MESSAGE;
}
export function soonMessage(): string {
  return state.config?.soon_msg || 'This tool is coming soon.';
}

/** Compares dotted versions: -1, 0, 1. */
export function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}
