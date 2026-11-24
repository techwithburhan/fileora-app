/**
 * Saving app data so that closing the app (or Android stopping it) at any moment can't wipe it.
 *
 * Before 0.6 the data files were overwritten in place: if the app was closed while a file was
 * being written, the half-written file could not be read at the next start and the app began
 * with empty lists. Now each save writes a new file first, keeps the previous good copy as
 * ".bak", and only then puts the new file in place. Reading falls back to the backup.
 *
 * Saves are also written immediately when the app goes to the background (flushAll), instead
 * of waiting for the short delay that groups quick changes together.
 */
import BlobUtil from 'react-native-blob-util';

const chains = new Map<string, Promise<void>>();

async function write(path: string, text: string) {
  const fs = BlobUtil.fs;
  const tmp = `${path}.tmp`;
  const bak = `${path}.bak`;
  await fs.writeFile(tmp, text, 'utf8');
  // the new file must read back completely before it replaces the old one
  const check = await fs.readFile(tmp, 'utf8');
  if (check.length !== text.length) throw new Error('save check failed');
  if (await fs.exists(path)) await fs.mv(path, bak).catch(() => {});
  await fs.mv(tmp, path);
}

/** Saves text safely; saves to the same file run one after another. */
export function writeSafe(path: string, text: string): Promise<void> {
  const prev = chains.get(path) ?? Promise.resolve();
  const next = prev.then(() => write(path, text)).catch(() => {});
  chains.set(path, next);
  return next;
}

export function writeJsonSafe(path: string, data: unknown): Promise<void> {
  return writeSafe(path, JSON.stringify(data));
}

/**
 * Reads JSON saved with writeJsonSafe: the file; if it is missing or damaged, the new copy
 * (only missing-file case: it was complete but not yet moved into place), then the backup.
 */
export async function readJsonSafe<T = unknown>(path: string): Promise<T | null> {
  const fs = BlobUtil.fs;
  for (const p of [path, `${path}.tmp`, `${path}.bak`]) {
    try {
      if (!(await fs.exists(p))) continue;
      const text = await fs.readFile(p, 'utf8');
      if (!text) continue;
      return JSON.parse(text) as T;
    } catch {
      // damaged copy: try the next one
    }
  }
  return null;
}

/* ---------- write pending saves now (app going to the background or an error) ---------- */

const flushers = new Set<() => void | Promise<void>>();

/** Registers a function that writes a store's pending changes at once. */
export function onFlush(fn: () => void | Promise<void>) {
  flushers.add(fn);
  return () => flushers.delete(fn);
}

export async function flushAll() {
  await Promise.all([...flushers].map(f => Promise.resolve().then(f).catch(() => {})));
  await Promise.all([...chains.values()]);
}
