/**
 * A tool's page text ("After-Tool Content") and its Questions & Answers, for the tool's screen in
 * the app. Read from the website only when App Center switches these sections on, and kept on
 * the phone so they still show offline. GET {site}/wp-json/fileora/v1/app-tool/{id}
 */
import { useEffect, useState } from 'react';
import BlobUtil from 'react-native-blob-util';
import { SITE } from '../config';
import { DATA } from '../store/files';
import { readJsonSafe, writeJsonSafe } from './safeFile';

export type ToolBlock = { t: 'h' | 'p' | 'li'; text: string };
export type ToolInfo = { content: ToolBlock[]; faq: { q: string; a: string }[]; at: number };

const DIR = `${DATA}/tool-info`;
const mem = new Map<string, ToolInfo>();
const clean = (v: unknown): ToolInfo | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as { content?: unknown; faq?: unknown; at?: unknown };
  const content = (Array.isArray(o.content) ? o.content : [])
    .filter((b): b is ToolBlock => !!b && typeof b === 'object' && typeof (b as ToolBlock).text === 'string')
    .map(b => ({ t: b.t === 'h' || b.t === 'li' ? b.t : 'p', text: b.text.slice(0, 1200) }) as ToolBlock)
    .slice(0, 120);
  const faq = (Array.isArray(o.faq) ? o.faq : [])
    .filter((x): x is { q: string; a: string } => !!x && typeof x === 'object' && typeof (x as { q: unknown }).q === 'string' && typeof (x as { a: unknown }).a === 'string')
    .map(x => ({ q: x.q.slice(0, 300), a: x.a.slice(0, 2000) }))
    .slice(0, 30);
  return { content, faq, at: Number(o.at) || Date.now() };
};

async function fetchInfo(id: string): Promise<ToolInfo | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(`${SITE}/wp-json/fileora/v1/app-tool/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' }, signal: ctl.signal });
    if (!r.ok) return null;
    const info = clean({ ...(await r.json()), at: Date.now() });
    if (info) {
      mem.set(id, info);
      await BlobUtil.fs.mkdir(DIR).catch(() => {});
      writeJsonSafe(`${DIR}/${id}.json`, info).catch(() => {});
    }
    return info;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The tool's text and questions: saved copy first, then the website's (when `enabled`). */
export function useToolInfo(id: string, enabled: boolean): ToolInfo | null {
  const [info, setInfo] = useState<ToolInfo | null>(() => (enabled ? (mem.get(id) ?? null) : null));
  useEffect(() => {
    if (!enabled) {
      setInfo(null);
      return;
    }
    let live = true;
    (async () => {
      if (!mem.has(id)) {
        const saved = clean(await readJsonSafe(`${DIR}/${id}.json`).catch(() => null));
        if (saved && live) {
          mem.set(id, saved);
          setInfo(saved);
        }
      }
      const fresh = await fetchInfo(id);
      if (fresh && live) setInfo(fresh);
    })();
    return () => {
      live = false;
    };
  }, [id, enabled]);
  return info;
}
