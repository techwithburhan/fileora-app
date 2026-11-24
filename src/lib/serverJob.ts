/**
 * Runs a Fileora API tool on the processing server: upload → poll the status with the task's
 * token → download the result once.
 *
 *  1. Your VPS directly (App Center → API tools → "Processing server address for the app"):
 *     POST {api_base}/app/v1/jobs/{tool}. The server checks limits per phone (IP) and gives a
 *     token that only opens this one task. No key is in the app.
 *  2. The website (same as the website's own tool pages), when no address is set yet or the VPS
 *     can't be reached: POST {site}/wp-json/fileora/v1/jobs/{tool}. WordPress adds the key.
 */
import BlobUtil from 'react-native-blob-util';
import { SITE } from '../config';
import { apiBase } from '../remote/remote';
import { safeName, stripScheme } from '../store/files';
import { tr } from '../i18n/i18n';

export type JobStatus = {
  status: 'queued' | 'running' | 'done' | 'failed'; ahead?: number; name?: string; size?: number; error?: string; kind?: string;
  text?: string; need?: string; note?: string;
  /** server 2.8: how many results, each result, the files that couldn't be processed, progress */
  count?: number; files?: { n: number; name: string; size: number; note?: string }[];
  failed?: { n: number; name: string; error: string; need?: string }[]; progress?: { done: number; total: number };
};
export type JobFile = { uri: string; name: string; mime: string };
/**
 * One result: path/name. 2.21: 2 results come as `files` (each downloaded on its own); 3 or more as one
 * ZIP (`zip`, the server's archive); `failed` lists the files the server couldn't process.
 */
export type JobResult = {
  path: string; name: string; text?: string; kind?: string; note?: string;
  files?: { path: string; name: string; note?: string }[];
  zip?: { path: string; name: string; count: number };
  failed?: { name: string; error: string }[];
};

class Unreachable extends Error {}

/** A task that needs the PDF's password: the screen asks for it and runs the task again with options.opw. */
export class NeedPassword extends Error {}

/**
 * The VPS gateway answered "not here" (FILEORA_APP_GATEWAY=0, an old server, or an HTML error page
 * from Nginx). Until app 1.0 this ended the task with "Not found." and only a later try (after the
 * App Center settings were read again) went through the website. Now the task goes on through the
 * website straight away, and the VPS is skipped for 10 minutes.
 */
let vpsSkipUntil = 0;
const VPS_SKIP_MS = 10 * 60000;

async function json<T>(r: Response): Promise<T> {
  try {
    return (await r.json()) as T;
  } catch {
    throw new Error(tr('The server answered with HTTP {code}.', { code: r.status }));
  }
}

/** Where to send the task, in order: the VPS (if set), then the website. */
export function jobBases(): string[] {
  const site = `${SITE}/wp-json/fileora/v1`;
  const vps = apiBase();
  return vps && Date.now() >= vpsSkipUntil ? [`${vps}/app/v1`, site] : [site];
}

async function submit(base: string, tool: string, files: JobFile[], options: Record<string, unknown>, url?: string) {
  const form = new FormData();
  for (const f of files) {
    const uri = f.uri.startsWith('/') ? `file://${f.uri}` : f.uri;
    form.append('files[]', { uri, name: f.name, type: f.mime } as unknown as Blob);
  }
  if (url) form.append('url', url);
  form.append('options', JSON.stringify(options));
  let r: Response;
  try {
    r = await fetch(`${base}/jobs/${tool}`, { method: 'POST', body: form, headers: { Accept: 'application/json' } });
  } catch {
    throw new Unreachable('The processing server can’t be reached. Check your internet connection.');
  }
  const vps = base.endsWith('/app/v1');
  // a gateway error from the VPS itself (down, restarting): try the next address
  if (r.status === 502 || r.status === 503 || r.status === 504) {
    if (vps) vpsSkipUntil = Date.now() + 60000;
    if (r.status !== 503 || vps) throw new Unreachable(tr('The processing server isn’t answering (HTTP {code}).', { code: r.status }));
  }
  // the gateway is off or not there (404/405/403/401, or not JSON): use the website instead
  let created: { job?: string; token?: string; error?: string; message?: string; need?: string };
  try {
    created = (await r.json()) as typeof created;
  } catch {
    if (vps) {
      vpsSkipUntil = Date.now() + VPS_SKIP_MS;
      throw new Unreachable(tr('The processing server answered with HTTP {code}.', { code: r.status }));
    }
    throw new Error(tr('The server answered with HTTP {code}.', { code: r.status }));
  }
  if (vps && [401, 403, 404, 405, 410].includes(r.status)) {
    // "This tool isn't available in the app" only concerns this tool; anything else: the gateway is off
    if (!/tool/i.test(created.error ?? '')) vpsSkipUntil = Date.now() + VPS_SKIP_MS;
    throw new Unreachable(created.error ?? `HTTP ${r.status}`);
  }
  if (r.status === 503 && /connected/i.test(created.error ?? '')) throw new Unreachable(created.error ?? 'The server isn’t connected.');
  if (r.status !== 202 || !created.job || !created.token) throw new Error(created.error ?? created.message ?? tr('The server couldn’t accept this request (error {code}).', { code: r.status }));
  return { job: created.job, token: created.token };
}

export async function runServerTool(
  tool: string,
  files: JobFile[],
  options: Record<string, unknown>,
  onStatus: (s: JobStatus) => void,
  signal?: { cancelled: boolean },
  url?: string,
): Promise<JobResult> {
  let base = '';
  let job = '';
  let token = '';
  let lastErr: Error | null = null;
  const bases = jobBases();
  for (let i = 0; i < bases.length && !base; i++) {
    const b = bases[i];
    // the last address gets a second try after a short pause (a first connection can time out)
    for (let attempt = 0; attempt < (i === bases.length - 1 ? 2 : 1) && !base; attempt++) {
      if (signal?.cancelled) throw new Error('Cancelled.');
      if (attempt) await new Promise<void>(res => setTimeout(() => res(), 1500));
      try {
        ({ job, token } = await submit(b, tool, files, options, url));
        base = b;
      } catch (e) {
        lastErr = e as Error;
        if (!(e instanceof Unreachable)) throw e;
      }
    }
  }
  if (!base) throw lastErr ?? new Error('The processing server can’t be reached.');
  const headers = { 'X-Fileora-Token': token, Accept: 'application/json' };

  let st: JobStatus = { status: 'queued' };
  let wait = 900;
  let misses = 0;
  const started = Date.now();
  while (st.status !== 'done') {
    if (signal?.cancelled) {
      fetch(`${base}/jobs/${job}`, { method: 'DELETE', headers }).catch(() => {});
      throw new Error('Cancelled.');
    }
    if (Date.now() - started > 30 * 60000) throw new Error('This is taking too long. Try a smaller file.');
    await new Promise<void>(res => setTimeout(() => res(), wait));
    wait = Math.min(wait + 300, 3000);
    let r: Response;
    try {
      r = await fetch(`${base}/jobs/${job}?t=${Date.now()}`, { headers });
    } catch {
      if (++misses > 20) throw new Error('We lost the connection to the server. Please run the task again.');
      continue; // brief network hiccup: keep polling
    }
    if (r.status === 502 && ++misses <= 20) continue;
    st = await json<JobStatus>(r);
    if (!r.ok && !st.status) throw new Error(st.error ?? 'We lost track of this task. Please run it again.');
    misses = 0;
    onStatus(st);
    if (st.status === 'failed') {
      if (st.need === 'password') throw new NeedPassword(st.error ?? 'This PDF needs its password.');
      throw new Error(st.error ?? 'The server couldn’t process this file.');
    }
  }

  if (st.kind === 'text') {
    // e.g. AI summary: the text comes with the status; it is also saved as a .txt file
    const name = safeName(st.name ?? `${tool}-result.txt`);
    const path = `${BlobUtil.fs.dirs.CacheDir}/${Date.now()}-${name}`;
    await BlobUtil.fs.writeFile(path, st.text ?? '', 'utf8');
    return { path, name, text: st.text, kind: 'text', note: st.note };
  }
  const failed = (st.failed ?? []).map(f => ({ name: f.name, error: f.error }));
  const fetchTo = async (name: string, query: string) => {
    const path = `${BlobUtil.fs.dirs.CacheDir}/${Date.now()}-${safeName(name)}`;
    const res = await BlobUtil.config({ path }).fetch('GET', `${base}/jobs/${job}/file${query}`, { 'X-Fileora-Token': token });
    const code = res.info().status;
    if (code !== 200) {
      await BlobUtil.fs.unlink(path).catch(() => {});
      throw new Error(code === 410 ? 'The result was already downloaded. Please run the task again.' : tr('Download failed (HTTP {code}).', { code }));
    }
    return stripScheme(res.path() ?? path);
  };
  const count = st.count ?? 1;
  const list = st.files ?? [];
  // 2 results: each one on its own (no ZIP for 1–2 files). "of" tells the website when all were sent.
  if (count === 2 && list.length === 2) {
    const got = [];
    for (const f of list) got.push({ path: await fetchTo(f.name, `?n=${f.n}&of=2`), name: safeName(f.name), note: f.note });
    return { path: got[0].path, name: got[0].name, note: got[0].note, files: got, failed };
  }
  const name = safeName(st.name ?? `${tool}-result`);
  const path = await fetchTo(name, '');
  if (count >= 3) return { path, name, zip: { path, name, count }, failed, note: st.note };
  return { path, name, note: list[0]?.note ?? st.note, failed };
}

/** Very large selections go to the server in parts of this many files, one part after the other. */
export const SERVER_BATCH = 20;
