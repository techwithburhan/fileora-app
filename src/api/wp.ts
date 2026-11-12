/**
 * Public WordPress REST API of fileora.in. Requests are made one at a time (never in parallel)
 * and retried once on a 5xx answer, to keep load on the shared hosting low.
 */
import { SITE } from '../config';

export type Post = { id: number; link: string; title: string; excerpt: string; date: string; image?: string };

const TIMEOUT = 15000;

async function get<T>(path: string): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const r = await fetch(SITE + path, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
      if (r.status >= 500 && attempt === 0) {
        last = new Error('HTTP ' + r.status);
        await new Promise<void>(res => setTimeout(() => res(), 1200));
        continue;
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return (await r.json()) as T;
    } catch (e) {
      last = e;
      if (attempt === 1) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last instanceof Error ? last : new Error('Network error');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export function decode(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

type RawPost = {
  id: number;
  link: string;
  date: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  _embedded?: { 'wp:featuredmedia'?: { source_url?: string; media_details?: { sizes?: Record<string, { source_url: string }> } }[] };
};

export async function getPosts(page = 1, perPage = 10): Promise<Post[]> {
  const raw = await get<RawPost[]>(
    `/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed=wp:featuredmedia&_fields=id,link,date,title,excerpt,_links,_embedded`,
  );
  return raw.map(p => {
    const m = p._embedded?.['wp:featuredmedia']?.[0];
    const sizes = m?.media_details?.sizes;
    return {
      id: p.id,
      link: p.link,
      date: p.date,
      title: decode(p.title.rendered),
      excerpt: decode(p.excerpt.rendered),
      image: sizes?.medium_large?.source_url ?? sizes?.medium?.source_url ?? m?.source_url,
    };
  });
}

/** Address of the first page that exists with one of these slugs, or null. */
export async function pageLink(slugs: string[]): Promise<string | null> {
  for (const s of slugs) {
    const r = await get<{ link: string }[]>(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(s)}&_fields=link`);
    if (r.length && r[0].link) return r[0].link;
  }
  return null;
}
