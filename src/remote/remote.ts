/**
 * Settings managed from WordPress (Fileora → App Center), read from the public endpoint
 * /wp-json/fileora/v1/app-config: API tools on/off, maintenance, per-tool status, banner,
 * force update, links, popular tools, navigation, ads, promotions, the Daily Update popup,
 * notification history and which Notification & Privacy settings people may change.
 * Cached on the phone so the app works offline.
 *
 * Also keeps this install's own preferences: notifications, anonymous usage, dismissed banners,
 * and the random install ID used for check-ins. Saved in DocumentDir/fileora/remote.json.
 */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { API_TOOLS_LIVE, MAINTENANCE_MESSAGE, SITE } from '../config';
import { DATA, ensureDirs } from '../store/files';
import { onFlush, readJsonSafe, writeJsonSafe } from '../lib/safeFile';

export type ToolFlag = 'soon' | 'off';
/** One bottom-bar or side-menu item from App Center → Navigation. */
export type NavItem = {
  id: string;
  label: string;
  icon: string;
  open: 'screen' | 'cat' | 'tool' | 'url';
  value: string;
  status: 'on' | 'soon' | 'off';
  msg: string;
};
export type Nav = { bar: NavItem[]; menu: NavItem[] };
/** One notification in the Alerts history (sent from App Center). `at` = seconds. */
export type InboxItem = { id: string; title: string; body: string; image: string; open: string; tool: string; link: string; topic: string; older: string; at: number };
/** A Notification & Privacy setting: may people change it, and its value when they may not. */
export type Control = { allow: boolean; def: boolean | null };
export type ControlKey = 'notify' | 'topics' | 'quiet' | 'private' | 'usage' | 'test' | 'reset';
export type AdPlacement = 'home_native' | 'tool_banner' | 'task_interstitial' | 'result_rect' | 'reward_adfree';
export const AD_PLACEMENTS: AdPlacement[] = ['home_native', 'tool_banner', 'task_interstitial', 'result_rect', 'reward_adfree'];
export type AdsConfig = {
  on: boolean;
  test: boolean;
  /** ad unit ID per shown placement, or "test" for Google's test ads */
  units: Partial<Record<AdPlacement, string>>;
  every: number;
  gap: number;
  skip: number;
  reward_hours: number;
};
export type PromoItem = { id: string; title: string; text: string; image: string; button: string; link: string };
export type Promo = { title: string; intro: string; items: PromoItem[] };
export type Popup = { id: string; title: string; text: string; button: string; link: string; freq: 'daily' | 'once' | 'always' };
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
  /** null = App Center has no navigation (older plugin): the app uses its built-in one */
  nav: Nav | null;
  tracking: boolean;
  checkin_minutes: number;
  cache_seconds: number;
  topics: string[];
  /* app 0.7+ (older plugins send none of these: the defaults below apply) */
  inbox: InboxItem[];
  controls: Record<ControlKey, Control>;
  test_push: boolean;
  ads: AdsConfig | null;
  promo: Promo | null;
  popup: Popup | null;
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
  quiet: boolean; // notifications arrive without sound or pop-up
  private: boolean; // nothing shown on the lock screen
};
type State = {
  loaded: boolean;
  config: RemoteConfig | null;
  fetchedAt: number;
  install: string;
  prefs: Prefs;
  /** popup = "<id>|<YYYY-MM-DD>" of the Daily Update popup last closed */
  dismissed: { ann?: string; update?: string; popup?: string };
  subscribed: string[]; // FCM topics this install is subscribed to
};

const FILE = `${DATA}/remote.json`;
/** This app's platform in App Center: "android" or "ios" (versions, force update, monitoring). */
export const PLATFORM: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android';
export const CONFIG_URL = `${SITE}/wp-json/fileora/v1/app-config?platform=${PLATFORM}`;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function randomId() {
  const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 16; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

/** Choices of a fresh install (also what "Reset notification settings" goes back to). */
export function defaultPrefs(): Prefs {
  return { notify: true, topics: Object.fromEntries(TOPIC_LABELS.map(t => [t.id, true])), askedAt: 0, usage: true, quiet: false, private: false };
}

let state: State = {
  loaded: false,
  config: null,
  fetchedAt: 0,
  install: '',
  prefs: defaultPrefs(),
  dismissed: {},
  subscribed: [],
};

function emit() {
  listeners.forEach(l => l());
}
function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (!state.loaded) return Promise.resolve(); // never overwrite saved choices before they were read
  const { config, fetchedAt, install, prefs, dismissed, subscribed } = state;
  return writeJsonSafe(FILE, { config, fetchedAt, install, prefs, dismissed, subscribed });
}
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
}
onFlush(() => (saveTimer ? save() : undefined));
function set(next: Partial<State>) {
  state = { ...state, ...next };
  emit();
  persist();
}

const NAV_OPEN = ['screen', 'cat', 'tool', 'url'];
function cleanNavList(v: unknown, max: number): NavItem[] {
  if (!Array.isArray(v)) return [];
  const out: NavItem[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const i = x as Record<string, unknown>;
    const open = String(i.open ?? '');
    const value = String(i.value ?? '');
    if (!NAV_OPEN.includes(open) || !value) continue;
    if (open === 'screen' && value === 'resume') continue; // ATS Resume was removed in app 0.7
    if (open === 'url' && !/^(https:\/\/|mailto:)/i.test(value)) continue;
    out.push({
      id: String(i.id ?? '').slice(0, 40) || `${open}-${value}`,
      label: String(i.label ?? '').slice(0, 24) || value,
      icon: String(i.icon ?? 'info'),
      open: open as NavItem['open'],
      value,
      status: i.status === 'soon' || i.status === 'off' ? i.status : 'on',
      msg: String(i.msg ?? '').slice(0, 160),
    });
  }
  return out.slice(0, max);
}
/** Navigation from App Center, or null when missing or unusable (Home must be in the bar, Settings somewhere). */
function cleanNav(v: unknown): Nav | null {
  if (!v || typeof v !== 'object') return null;
  const n = v as { bar?: unknown; menu?: unknown };
  const bar = cleanNavList(n.bar, 6);
  const menu = cleanNavList(n.menu, 20);
  const isOn = (screen: string) => (i: NavItem) => i.open === 'screen' && i.value === screen && i.status === 'on';
  if (!bar.some(isOn('home'))) return null;
  if (!bar.some(isOn('settings')) && !menu.some(isOn('settings'))) return null;
  return { bar, menu };
}

const httpsOnly = (v: unknown) => (typeof v === 'string' && /^https:\/\//i.test(v) ? v : '');
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function cleanInbox(v: unknown): InboxItem[] {
  if (!Array.isArray(v)) return [];
  const out: InboxItem[] = [];
  for (const x of v.slice(0, 50)) {
    if (!x || typeof x !== 'object') continue;
    const i = x as Record<string, unknown>;
    const id = text(i.id, 40);
    const title = text(i.title, 120);
    if (!id || !title) continue;
    out.push({
      id,
      title,
      body: text(i.body, 400),
      image: httpsOnly(i.image),
      open: text(i.open, 12) || 'home',
      tool: text(i.tool, 40),
      link: httpsOnly(i.link),
      topic: text(i.topic, 20) || 'all',
      older: text(i.older, 16),
      at: Math.max(0, Number(i.at) || 0),
    });
  }
  return out;
}

const CONTROL_DEFAULTS: Record<ControlKey, Control> = {
  notify: { allow: true, def: true },
  topics: { allow: true, def: null },
  quiet: { allow: true, def: false },
  private: { allow: true, def: false },
  usage: { allow: true, def: true },
  test: { allow: true, def: null },
  reset: { allow: true, def: null },
};
function cleanControls(v: unknown): Record<ControlKey, Control> {
  const out = { ...CONTROL_DEFAULTS };
  if (!v || typeof v !== 'object') return out;
  for (const k of Object.keys(CONTROL_DEFAULTS) as ControlKey[]) {
    const c = (v as Record<string, unknown>)[k];
    if (!c || typeof c !== 'object') continue;
    const o = c as { allow?: unknown; def?: unknown };
    out[k] = { allow: o.allow !== false, def: CONTROL_DEFAULTS[k].def === null ? null : typeof o.def === 'boolean' ? o.def : (CONTROL_DEFAULTS[k].def as boolean) };
  }
  return out;
}

const UNIT_RE = /^ca-app-pub-\d{10,20}\/\d{6,12}$/;
function cleanAds(v: unknown): AdsConfig | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  const units: Partial<Record<AdPlacement, string>> = {};
  if (a.units && typeof a.units === 'object')
    for (const p of AD_PLACEMENTS) {
      const u = (a.units as Record<string, unknown>)[p];
      if (u === 'test' || (typeof u === 'string' && UNIT_RE.test(u))) units[p] = u;
    }
  const num = (x: unknown, min: number, max: number, d: number) => Math.max(min, Math.min(max, Number.isFinite(Number(x)) && x !== null && x !== '' ? Number(x) : d));
  return {
    on: a.on === true && Object.keys(units).length > 0,
    test: a.test === true,
    units,
    every: num(a.every, 1, 20, 3),
    gap: num(a.gap, 0, 120, 3),
    skip: num(a.skip, 0, 20, 2),
    reward_hours: num(a.reward_hours, 1, 72, 24),
  };
}

function cleanPromo(v: unknown): Promo | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const items: PromoItem[] = [];
  if (Array.isArray(p.items))
    for (const x of p.items.slice(0, 20)) {
      if (!x || typeof x !== 'object') continue;
      const i = x as Record<string, unknown>;
      const title = text(i.title, 80);
      if (!title) continue;
      items.push({ id: text(i.id, 16) || title, title, text: text(i.text, 400), image: httpsOnly(i.image), button: text(i.button, 30), link: httpsOnly(i.link) });
    }
  return items.length ? { title: text(p.title, 60) || 'Offers & updates', intro: text(p.intro, 300), items } : null;
}

function cleanPopup(v: unknown): Popup | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  const title = text(p.title, 80);
  const link = httpsOnly(p.link);
  if (!title || !link) return null;
  const freq = p.freq === 'once' || p.freq === 'always' ? p.freq : 'daily';
  return { id: text(p.id, 20) || title, title, text: text(p.text, 240), button: text(p.button, 24) || 'Learn more', link, freq };
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
    nav: cleanNav(c.nav),
    tracking: c.tracking !== false,
    checkin_minutes: Math.max(5, Math.min(1440, Number(c.checkin_minutes) || 30)),
    cache_seconds: Math.max(0, Math.min(3600, Number(c.cache_seconds) || 60)),
    topics: arr(c.topics),
    inbox: cleanInbox(c.inbox),
    controls: cleanControls(c.controls),
    test_push: c.test_push === true,
    ads: cleanAds(c.ads),
    promo: cleanPromo(c.promo),
    popup: cleanPopup(c.popup),
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
      const d = await readJsonSafe<Record<string, any>>(FILE);
      if (d) {
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
  dismiss(kind: 'ann' | 'update' | 'popup', id: string) {
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

/* ---------- Notification & Privacy settings managed from App Center ---------- */

/** A setting's rule from App Center (everything allowed with an older plugin or offline). */
export function control(k: ControlKey): Control {
  return state.config?.controls?.[k] ?? CONTROL_DEFAULTS[k];
}

/**
 * The person's choices with App Center's locks applied: a locked setting uses App Center's
 * default instead of what the person chose earlier.
 */
export function effectivePrefs(p: Prefs = state.prefs): Prefs {
  const pick = (k: 'notify' | 'quiet' | 'private' | 'usage') => {
    const c = control(k);
    return c.allow || c.def === null ? p[k] : c.def;
  };
  const topics = control('topics').allow ? p.topics : Object.fromEntries(TOPIC_LABELS.map(t => [t.id, true]));
  return { ...p, notify: pick('notify'), quiet: pick('quiet'), private: pick('private'), usage: pick('usage'), topics };
}

