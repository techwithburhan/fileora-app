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
import { applyCtl, resolveCtl, touchedFromOld } from './settingsLogic';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { API_TOOLS_LIVE, MAINTENANCE_MESSAGE, SITE } from '../config';
import { DATA, ensureDirs } from '../store/files';
import { onFlush, readJsonSafe, writeJsonSafe } from '../lib/safeFile';
import { APP_VERSION } from '../version';

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
/**
 * App Center → Notifications → Notification & Privacy settings (plugin 2.16+): per setting
 *   show     shown, people can change it; value = the starting choice until they do
 *   fix      shown with a lock at value; people can't change it
 *   hide     not shown; value is used
 *   disable  shown greyed out and off (a button can't be used)
 */
export type SettingMode = 'show' | 'fix' | 'hide' | 'disable';
export type SettingCtl = { mode: SettingMode; value: boolean | null };
export const TOGGLE_SETTINGS = ['notify', 'quiet', 'private', 'updates', 'news', 'tools', 'offers', 'blog', 'usage'] as const;
export const ACTION_SETTINGS = ['check', 'test', 'sound', 'reset'] as const;
export type SettingKey = (typeof TOGGLE_SETTINGS)[number] | (typeof ACTION_SETTINGS)[number];
/** App Center: tool page sections and the menu's "Open fileora.in" (plugin 2.16+). */
/** App Center → Manage → Processing screen (plugin 2.18): how a working tool shows progress. */
export type ProgressMode = 'detailed' | 'simple' | 'off';
export type UiConfig = {
  menu_website: boolean;
  progress: { browser: ProgressMode; server: ProgressMode };
  tool: { website_link: boolean; breadcrumbs: boolean; after_content: boolean; more_tools: boolean; faq: boolean };
};
/** Alerts deleted automatically after `hours`, or by an admin (ids, or everything up to `before`). */
export type InboxPurge = { hours: number; ids: string[]; before: number };
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
export type FestivalAnim = 'none' | 'snow' | 'hearts' | 'petals' | 'stars' | 'sparkles' | 'fireworks' | 'lanterns' | 'colours' | 'confetti';
/** App Center → Festival Themes (plugin 2.20+): the theme shown now, or the next one (cached ahead). */
export type Festival = {
  id: string;
  v: string;
  name: string;
  greeting: string;
  sub: string;
  /** one of the ten festivals that come with the app (their texts are translated in the app) */
  builtin: boolean;
  /** built-in artwork drawn from the copy in the app ('' = none) */
  design: string;
  /** artwork uploaded in App Center (https), shown instead of the design */
  image: string;
  /** buttons, active tab and header line ('' = the normal Fileora green) */
  accent: string;
  /** text colour on the banner */
  ink: string;
  animation: FestivalAnim;
  anim_secs: number;
  anim_freq: 'open' | 'daily' | 'once';
  link: string;
  /** festival_next only: first day (YYYY-MM-DD) */
  from?: string;
};
export type RemoteConfig = {
  v: number;
  api_live: boolean;
  api_tools: string[];
  /** App Center → API tools: the processing server's public address for the app (https://…); '' = through the website */
  api_base: string;
  maintenance_msg: string;
  soon_msg: string;
  tools: Record<string, ToolFlag>;
  site_off: string[];
  app_maintenance: { title: string; text: string } | null;
  announcement: { id: string; style: 'info' | 'offer' | 'warning'; title: string; text: string; button: string; link: string } | null;
  /** force: the "Please update" screen is on (plugin 2.22+); title/message: App Center's own text ('' = the app's) */
  update: { latest: string; min: string; url: string; notes: string; force: boolean; title: string; message: string };
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
  /* app 0.9+ (plugin 2.16+) */
  settings_ctl: Partial<Record<SettingKey, SettingCtl>> | null;
  ui: UiConfig;
  inbox_purge: InboxPurge;
  test_push: boolean;
  ads: AdsConfig | null;
  promo: Promo | null;
  popup: Popup | null;
  /* app 1.1+ (plugin 2.20+) */
  festival: Festival | null;
  festival_next: Festival | null;
  /* app 1.2+ (plugin 2.22+) */
  /** the site registers this phone's notification ID for fast direct delivery */
  push_direct: boolean;
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
  /** app 1.0: a short, quiet party-popper sound when a file is ready (off = only the confetti) */
  celebrate?: boolean;
  /** settings the person changed themselves (until then App Center's starting value applies) */
  touched?: string[];
  /** app 1.2: when the first-launch permissions screen was finished (0/undefined = not yet) */
  onboarded?: number;
  /** app 1.2 (iPhone): the camera was explained before iOS asked for it the first time */
  cameraExplained?: boolean;
};
/** This phone's notification ID as registered with the website for direct delivery (app 1.2+). */
export type PushReg = { key: string; at: number; direct: boolean };
type State = {
  loaded: boolean;
  config: RemoteConfig | null;
  fetchedAt: number;
  install: string;
  prefs: Prefs;
  /** popup = "<id>|<YYYY-MM-DD>" of the Daily Update popup last closed */
  dismissed: { ann?: string; update?: string; popup?: string; festival?: string; fanim?: string };
  subscribed: string[]; // FCM topics this install is subscribed to
  /** app 1.2: ETag of the settings last fetched (a 304 answer = nothing changed) */
  etag: string;
  /** app 1.2: direct delivery registration (what was sent, when, and whether the site accepted it) */
  pushReg: PushReg | null;
  /** app 1.2.2: the version that last ran on this phone (to notice an update) */
  lastVersion: string;
  /** app 1.2.2: set when this phone was updated: from → to, and whether the "Updated" note was seen */
  updated: { from: string; to: string; at: number; seen: boolean } | null;
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
  return { notify: true, topics: Object.fromEntries(TOPIC_LABELS.map(t => [t.id, true])), askedAt: 0, usage: true, quiet: false, private: false, touched: [] };
}

let state: State = {
  loaded: false,
  config: null,
  fetchedAt: 0,
  install: '',
  prefs: defaultPrefs(),
  dismissed: {},
  subscribed: [],
  etag: '',
  pushReg: null,
  lastVersion: '',
  updated: null,
};

function emit() {
  listeners.forEach(l => l());
}
function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (!state.loaded) return Promise.resolve(); // never overwrite saved choices before they were read
  const { config, fetchedAt, install, prefs, dismissed, subscribed, etag, pushReg, lastVersion, updated } = state;
  return writeJsonSafe(FILE, { config, fetchedAt, install, prefs, dismissed, subscribed, etag, pushReg, lastVersion, updated });
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
  for (const x of v.slice(0, 120)) {
    if (!x || typeof x !== 'object') continue;
    const i = x as Record<string, unknown>;
    const id = text(i.id, 40);
    const title = text(i.title, 200);
    if (!id || !title) continue;
    out.push({
      id,
      title,
      body: text(i.body, 5000), // app 1.2: the whole message (plugin 2.22 sends up to 1000 characters)
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
const MODES: SettingMode[] = ['show', 'fix', 'hide', 'disable'];
function cleanSettingsCtl(v: unknown): Partial<Record<SettingKey, SettingCtl>> | null {
  if (!v || typeof v !== 'object') return null;
  const out: Partial<Record<SettingKey, SettingCtl>> = {};
  for (const k of [...TOGGLE_SETTINGS, ...ACTION_SETTINGS]) {
    const c = (v as Record<string, unknown>)[k];
    if (!c || typeof c !== 'object') continue;
    const o = c as { mode?: unknown; value?: unknown };
    const mode = MODES.includes(o.mode as SettingMode) ? (o.mode as SettingMode) : 'show';
    out[k] = { mode, value: typeof o.value === 'boolean' ? o.value : null };
  }
  return out;
}
/** Older plugins send no "ui": the app keeps its earlier look (website link in the menu, more tools). */
const UI_DEFAULT: UiConfig = { menu_website: true, progress: { browser: 'detailed', server: 'detailed' }, tool: { website_link: false, breadcrumbs: false, after_content: false, more_tools: true, faq: false } };
function cleanUi(v: unknown): UiConfig {
  if (!v || typeof v !== 'object') return UI_DEFAULT;
  const u = v as { menu_website?: unknown; tool?: Record<string, unknown>; progress?: Record<string, unknown> };
  const t = u.tool && typeof u.tool === 'object' ? u.tool : {};
  const pm = (x: unknown): ProgressMode => (x === 'simple' || x === 'off' ? x : 'detailed');
  return {
    menu_website: u.menu_website !== false,
    progress: { browser: pm(u.progress?.browser), server: pm(u.progress?.server) },
    tool: { website_link: t.website_link === true, breadcrumbs: t.breadcrumbs === true, after_content: t.after_content === true, more_tools: t.more_tools === true, faq: t.faq === true },
  };
}
function cleanPurge(v: unknown): InboxPurge {
  const p = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return {
    hours: Math.max(1, Math.min(2160, Number(p.hours) || 72)),
    ids: Array.isArray(p.ids) ? p.ids.filter((x): x is string => typeof x === 'string').slice(-300) : [],
    before: Math.max(0, Number(p.before) || 0),
  };
}

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

const ANIMS: FestivalAnim[] = ['none', 'snow', 'hearts', 'petals', 'stars', 'sparkles', 'fireworks', 'lanterns', 'colours', 'confetti'];
const hex = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : '');
function cleanFestival(v: unknown): Festival | null {
  if (!v || typeof v !== 'object') return null;
  const f = v as Record<string, unknown>;
  const id = text(f.id, 30);
  const greeting = text(f.greeting, 60);
  if (!id || !greeting) return null;
  const secs = Number(f.anim_secs);
  return {
    id,
    v: text(f.v, 20) || id,
    name: text(f.name, 50) || id,
    greeting,
    sub: text(f.sub, 120),
    builtin: f.builtin === true,
    design: /^[a-z0-9]{2,20}$/.test(String(f.design ?? '')) ? String(f.design) : '',
    image: httpsOnly(f.image),
    accent: hex(f.accent),
    ink: hex(f.ink) || '#FFFFFF',
    animation: ANIMS.includes(f.animation as FestivalAnim) ? (f.animation as FestivalAnim) : 'none',
    anim_secs: Number.isFinite(secs) ? Math.max(0, Math.min(15, Math.round(secs))) : 6,
    anim_freq: f.anim_freq === 'open' || f.anim_freq === 'once' ? f.anim_freq : 'daily',
    link: httpsOnly(f.link),
    from: /^\d{4}-\d{2}-\d{2}$/.test(String(f.from ?? '')) ? String(f.from) : undefined,
  };
}

/**
 * A navigation from a plugin older than 2.14 has no Alerts item: add it to the bar (before
 * Settings), or to the menu when the bar is full, like the plugin's own 2.14 update does.
 */
function withAlerts(nav: Nav | null): Nav | null {
  if (!nav) return null;
  const has = [...nav.bar, ...nav.menu].some(i => i.open === 'screen' && i.value === 'alerts');
  if (has) return nav;
  const alerts: NavItem = { id: 'alerts', label: 'Alerts', icon: 'bell', open: 'screen', value: 'alerts', status: 'on', msg: '' };
  if (nav.bar.length < 6) {
    const at = nav.bar.findIndex(i => i.open === 'screen' && i.value === 'settings');
    const bar = [...nav.bar];
    bar.splice(at < 0 ? bar.length : at, 0, alerts);
    return { ...nav, bar };
  }
  return { ...nav, menu: [...nav.menu, alerts] };
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
    api_base: /^https:\/\/[a-z0-9.-]+(:\d+)?(\/[\w./-]*)?$/i.test(str(c.api_base)) ? str(c.api_base).replace(/\/+$/, '') : '',
    maintenance_msg: str(c.maintenance_msg) || MAINTENANCE_MESSAGE,
    soon_msg: str(c.soon_msg) || 'This tool is coming soon.',
    tools,
    site_off: arr(c.site_off),
    app_maintenance: c.app_maintenance && typeof c.app_maintenance === 'object' ? { title: str(c.app_maintenance.title), text: str(c.app_maintenance.text) } : null,
    announcement: ann
      ? { id: str(ann.id), style: ann.style === 'offer' || ann.style === 'warning' ? ann.style : 'info', title: str(ann.title), text: str(ann.text), button: str(ann.button), link: str(ann.link) }
      : null,
    update: {
      latest: normVersion(str(c.update?.latest)),
      min: normVersion(str(c.update?.min)),
      url: str(c.update?.url),
      notes: str(c.update?.notes),
      // older plugins have no switch: a minimum means force update is on
      force: typeof c.update?.force === 'boolean' ? c.update.force : !!normVersion(str(c.update?.min)),
      title: text(c.update?.title, 80),
      message: text(c.update?.message, 400),
    },
    links: { terms: str(c.links?.terms), privacy: str(c.links?.privacy), contact: str(c.links?.contact), share: str(c.links?.share) || SITE, share_text: str(c.links?.share_text) },
    popular: arr(c.popular),
    nav: 'controls' in c ? cleanNav(c.nav) : withAlerts(cleanNav(c.nav)), // "controls" = plugin 2.14+
    tracking: c.tracking !== false,
    checkin_minutes: Math.max(5, Math.min(1440, Number(c.checkin_minutes) || 30)),
    cache_seconds: Math.max(0, Math.min(3600, Number(c.cache_seconds) || 60)),
    topics: arr(c.topics),
    inbox: cleanInbox(c.inbox),
    controls: cleanControls(c.controls),
    settings_ctl: cleanSettingsCtl(c.settings_ctl),
    ui: cleanUi(c.ui),
    inbox_purge: cleanPurge(c.inbox_purge),
    test_push: c.test_push === true,
    ads: cleanAds(c.ads),
    promo: cleanPromo(c.promo),
    popup: cleanPopup(c.popup),
    festival: cleanFestival(c.festival),
    festival_next: cleanFestival(c.festival_next),
    push_direct: c.push_direct === true,
  };
}

let inflight: Promise<string | null> | null = null;

async function fetchConfig(): Promise<string | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const headers: Record<string, string> = { Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' };
    if (state.etag && state.config) headers['If-None-Match'] = state.etag;
    const r = await fetch(`${CONFIG_URL}&_=${Date.now()}`, { headers, signal: ctl.signal });
    if (r.status === 304 && state.config) {
      set({ fetchedAt: Date.now() }); // unchanged: the copy on the phone is the newest
      return null;
    }
    if (!r.ok) return `config: HTTP ${r.status}`;
    const cfg = clean(await r.json());
    if (!cfg) return 'config: unexpected answer';
    set({ config: cfg, fetchedAt: Date.now(), etag: (r.headers.get('etag') || '').slice(0, 60) });
    return null;
  } catch (e) {
    return `config: ${e instanceof Error ? (e.name === 'AbortError' ? 'timeout' : e.message) : 'failed'}`;
  } finally {
    clearTimeout(timer);
  }
}

export const remote = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  async load() {
    // app 1.2.2: read once per app run. When Android re-creates the screen (Back on the first screen,
    // then opening Fileora or a link again) the app mounts again in the same run: reading the file
    // again would undo choices made in the last moment before they were written (e.g. "Continue").
    if (state.loaded) return;
    await ensureDirs();
    try {
      const d = await readJsonSafe<Record<string, any>>(FILE);
      if (d) {
        state = {
          ...state,
          config: clean(d.config),
          fetchedAt: Number(d.fetchedAt) || 0,
          install: typeof d.install === 'string' && /^[a-z0-9]{16}$/.test(d.install) ? d.install : '',
          prefs: (() => {
            const p: Prefs = { ...state.prefs, ...(d.prefs || {}), topics: { ...state.prefs.topics, ...(d.prefs?.topics || {}) } };
            // saved by app 0.8 or older: what differs from the defaults was the person's own choice
            if (d.prefs && !Array.isArray(d.prefs.touched)) p.touched = touchedFromOld(p, defaultPrefs());
            return p;
          })(),
          dismissed: d.dismissed || {},
          subscribed: Array.isArray(d.subscribed) ? d.subscribed : [],
          etag: typeof d.etag === 'string' ? d.etag.slice(0, 60) : '',
          pushReg: d.pushReg && typeof d.pushReg.key === 'string' ? { key: d.pushReg.key, at: Number(d.pushReg.at) || 0, direct: d.pushReg.direct === true } : null,
          lastVersion: typeof d.lastVersion === 'string' ? normVersion(d.lastVersion) : '',
          updated:
            d.updated && typeof d.updated.from === 'string' && typeof d.updated.to === 'string'
              ? { from: d.updated.from, to: d.updated.to, at: Number(d.updated.at) || 0, seen: d.updated.seen === true }
              : null,
        };
      }
    } catch {
      // damaged file: defaults
    }
    if (!state.install) state.install = randomId();
    // app 1.2.2: a new version is running → the saved settings are checked again at once (no 304,
    // no "fresh enough" copy), the closed "update available" banner is forgotten, and Settings →
    // App updates says "Updated from … to …".
    const now = normVersion(APP_VERSION);
    const had = state.lastVersion || (state.config ? '?' : ''); // installs older than 1.2.2 kept no version
    if (had && had !== now) {
      const dismissed = { ...state.dismissed };
      delete dismissed.update;
      state = { ...state, fetchedAt: 0, etag: '', dismissed, updated: { from: had === '?' ? '' : had, to: now, at: Date.now(), seen: false } };
    }
    state = { ...state, lastVersion: now, loaded: true };
    emit();
    persist();
  },

  /**
   * Fetches the settings. Returns an error text, or null when the app has the newest settings.
   *
   * App 1.2: always asks the website itself (never a copy kept by the phone's HTTP cache, a CDN or
   * a page cache: a unique address and no-cache headers), and sends the ETag of the copy it has,
   * so an unchanged answer is a tiny "304 Not Modified". Without force, a copy younger than
   * cache_seconds is used. Pull-to-refresh, "Try again", opening a notification and coming back
   * to the app force it. Several calls at the same time share one request.
   */
  refresh(force = false): Promise<string | null> {
    const c = state.config;
    if (!force && c && Date.now() - state.fetchedAt < c.cache_seconds * 1000) return Promise.resolve(null);
    if (inflight) return inflight;
    inflight = fetchConfig().finally(() => {
      inflight = null;
    });
    return inflight;
  },

  /** When the settings were last confirmed with the website (ms), 0 = never. */
  fetchedAt: () => state.fetchedAt,

  /** app 1.2.2: the "Updated to …" note was shown. */
  seenUpdated() {
    if (state.updated && !state.updated.seen) set({ updated: { ...state.updated, seen: true } });
  },

  setPushReg(r: PushReg | null) {
    set({ pushReg: r });
  },

  prefs(): Prefs {
    return state.prefs;
  },
  setPrefs(p: Partial<Prefs>) {
    set({ prefs: { ...state.prefs, ...p } });
  },
  /** A setting the person changed in Settings: from now on their choice counts, not App Center's starting value. */
  choose(p: Partial<Pick<Prefs, 'notify' | 'quiet' | 'private' | 'usage'>>) {
    const touched = [...new Set([...(state.prefs.touched ?? []), ...Object.keys(p)])];
    set({ prefs: { ...state.prefs, ...p, touched } });
  },
  setTopic(id: string, on: boolean) {
    const touched = [...new Set([...(state.prefs.touched ?? []), id])];
    set({ prefs: { ...state.prefs, topics: { ...state.prefs.topics, [id]: on }, touched } });
  },
  dismiss(kind: 'ann' | 'update' | 'popup' | 'festival' | 'fanim', id: string) {
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

/** The processing server the app talks to directly ('' when App Center has no address yet). */
export function apiBase(): string {
  return state.config?.api_base ?? '';
}
export function apiLive(): boolean {
  return state.config ? state.config.api_live : API_TOOLS_LIVE;
}
export function maintenanceMessage(): string {
  return state.config?.maintenance_msg || MAINTENANCE_MESSAGE;
}
export function soonMessage(): string {
  return state.config?.soon_msg || 'This tool is coming soon.';
}

/** "v1.2" / " 1.2.0 " / "1.2.0-beta" → "1.2" / "1.2.0" / "1.2.0"; anything without a number → "". */
export function normVersion(v: string): string {
  const m = /^\s*[vV]?(\d{1,4}(?:\.\d{1,4}){0,3})/.exec(String(v ?? ''));
  return m ? m[1] : '';
}

/** Compares dotted versions: -1, 0, 1 ("1.2" = "1.2.0"; "v1.2" is read as 1.2). */
export function cmpVersion(a: string, b: string): number {
  const pa = normVersion(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = normVersion(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * The version this install must have, or '' when no update is forced. App 1.2 rules:
 * - no minimum, or force update switched off in App Center → nothing is forced;
 * - a minimum above "latest" (a version that doesn't exist yet) is capped at "latest", so phones
 *   that installed the newest version are never blocked by a typo or an early change in App Center.
 */
export function requiredVersion(u: RemoteConfig['update'] | undefined | null): string {
  if (!u || !u.force) return '';
  const min = normVersion(u.min);
  if (!min) return '';
  const latest = normVersion(u.latest);
  return latest && cmpVersion(min, latest) > 0 ? latest : min;
}

/** Whether this version must update (pure: tested in __tests__/version.test.ts). */
export function mustUpdate(installed: string, u: RemoteConfig['update'] | undefined | null): boolean {
  const req = requiredVersion(u);
  return !!req && !!normVersion(installed) && cmpVersion(installed, req) < 0;
}

/**
 * app 1.2.2: where this install stands (pure: tested in __tests__/version.test.ts).
 * required = force update is on and this version is below the minimum; available = a newer
 * version is published; latest = installed ≥ latest; unknown = no settings yet.
 */
export type UpdateState = 'latest' | 'available' | 'required' | 'unknown';
export function updateState(installed: string, u: RemoteConfig['update'] | undefined | null): UpdateState {
  if (!u) return 'unknown';
  if (mustUpdate(installed, u)) return 'required';
  if (u.latest && cmpVersion(installed, u.latest) < 0) return 'available';
  return 'latest';
}

/** Build number as Gradle and Xcode make it from the version: 1.2.2 → 10202. */
export function buildNumber(v: string): number {
  const [a, b, c] = normVersion(v).split('.').map(n => parseInt(n, 10) || 0);
  return (a || 0) * 10000 + (b || 0) * 100 + (c || 0);
}

/* ---------- Notification & Privacy settings managed from App Center ---------- */

/** A setting's rule from App Center (everything allowed with an older plugin or offline). */
export function control(k: ControlKey): Control {
  return state.config?.controls?.[k] ?? CONTROL_DEFAULTS[k];
}

/** How App Center wants a setting shown (show / fix / hide / disable) and its value. */
export function settingCtl(k: SettingKey): SettingCtl {
  return resolveCtl(k, state.config?.settings_ctl, control);
}
/** Whether a setting's row is shown at all. */
export const settingShown = (k: SettingKey) => settingCtl(k).mode !== 'hide';
/** Whether people can change it (or use the button). */
export const settingOpen = (k: SettingKey) => {
  const m = settingCtl(k).mode;
  return m === 'show' || ((ACTION_SETTINGS as readonly string[]).includes(k) && m === 'fix');
};

/** The person's choices with App Center's settings applied (see applyCtl). */
export function effectivePrefs(p: Prefs = state.prefs): Prefs {
  return applyCtl(p, settingCtl, TOPIC_LABELS.map(t => t.id));
}

/** App Center's tool page sections and the menu's website link. */
export function uiConfig(): UiConfig {
  return state.config?.ui ?? UI_DEFAULT;
}

