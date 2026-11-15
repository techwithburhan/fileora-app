/**
 * Anonymous usage and check-ins for Fileora → App Center → App Monitoring.
 *
 * Sent: a random install ID (made on this phone, not linked to the person), app version,
 * Android version, phone model, and events: start (check-in), open, done, failed, error, push.
 * Never sent: names, phone numbers, e-mail, file names or file contents.
 *
 * Nothing is sent when the website switches tracking off or the person turns off
 * Settings → "Share anonymous usage".
 */
import { Platform } from 'react-native';
import BlobUtil from 'react-native-blob-util';
import { SITE } from '../config';
import { ROOT } from '../store/files';
import { APP_VERSION } from '../version';
import { remote } from './remote';

export type EventType = 'start' | 'open' | 'done' | 'failed' | 'error' | 'push';
type Ev = { t: number; type: EventType; tool?: string; bytes?: number; detail?: string };

const URL = `${SITE}/wp-json/fileora/v1/app-events`;
const FILE = `${ROOT}/telemetry.json`;
const MAX_QUEUE = 200;
const BATCH = 50; // the website takes up to 50 events per request
const MIN_GAP = 60 * 1000; // at most one ordinary send a minute (the website limits requests per hour)

let queue: Ev[] = [];
let loaded = false;
let sending = false;
let lastSend = 0;
let backoffUntil = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function allowed(): boolean {
  const s = remote.get();
  if (!s.prefs.usage) return false;
  if (s.config && !s.config.tracking) return false;
  return /^[a-z0-9]{16}$/.test(s.install);
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    BlobUtil.fs.writeFile(FILE, JSON.stringify(queue), 'utf8').catch(() => {});
  }, 500);
}

/** Error texts can mention a file: keep only the message, without file names or paths. */
export function cleanDetail(s: string): string {
  return s
    .replace(/(file|content):\/\/\S+/gi, '[path]')
    .replace(/\/[^\s'"]+/g, '[path]')
    .replace(/[^\s'"\\/]+\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|webp|heic|gif|bmp|tiff?|txt|csv|html?|zip|odt|rtf)\b/gi, '[file]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

export const telemetry = {
  async load() {
    if (loaded) return;
    loaded = true;
    try {
      if (await BlobUtil.fs.exists(FILE)) {
        const d = JSON.parse(await BlobUtil.fs.readFile(FILE, 'utf8'));
        if (Array.isArray(d)) queue = [...d.filter(e => e && typeof e.type === 'string' && typeof e.t === 'number'), ...queue].slice(-MAX_QUEUE);
      }
    } catch {
      queue = [];
    }
  },

  track(type: EventType, tool?: string, bytes?: number, detail?: string) {
    if (!allowed()) return;
    const e: Ev = { t: Date.now(), type };
    if (tool && /^[a-z][a-z0-9-]{1,19}$/.test(tool)) e.tool = tool;
    if (bytes && bytes > 0) e.bytes = Math.round(bytes);
    if (detail) e.detail = cleanDetail(detail);
    queue = [...queue, e].slice(-MAX_QUEUE);
    persist();
    if (queue.length >= 20) telemetry.flush();
  },

  /** A check-in: tells App Monitoring this install is online (also sends what is queued). */
  checkin() {
    if (!allowed()) return;
    queue = [...queue, { t: Date.now(), type: 'start' as const }].slice(-MAX_QUEUE);
    persist();
    telemetry.flush(true);
  },

  /** Clears what is waiting (when the person turns off anonymous usage). */
  clear() {
    queue = [];
    persist();
  },

  async flush(force = false) {
    if (sending || !queue.length) return;
    const now = Date.now();
    if (now < backoffUntil || (!force && now - lastSend < MIN_GAP)) return;
    if (!allowed()) {
      queue = [];
      persist();
      return;
    }
    sending = true;
    lastSend = now;
    const batch = queue.slice(0, BATCH);
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 15000);
      const constants = Platform.constants as { Model?: string; Brand?: string };
      const r = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          platform: 'android',
          install: remote.get().install,
          version: APP_VERSION,
          os: `Android ${Platform.Version}`,
          model: String(constants.Model || '').slice(0, 40),
          events: batch,
        }),
        signal: ctl.signal,
      });
      clearTimeout(timer);
      if (r.status === 429) backoffUntil = Date.now() + 20 * 60 * 1000;
      else if (r.ok || r.status === 400) {
        // sent (or refused as invalid, which a retry would not fix)
        queue = queue.slice(batch.length);
        persist();
      } else backoffUntil = Date.now() + 5 * 60 * 1000;
    } catch {
      backoffUntil = Date.now() + 2 * 60 * 1000; // offline: try again later
    } finally {
      sending = false;
    }
  },
};
