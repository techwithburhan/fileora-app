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

export type JobStatus = { status: 'queued' | 'running' | 'done' | 'failed'; ahead?: number; name?: string; size?: number; error?: string; kind?: string; text?: string };
export type JobFile = { uri: string; name: string; mime: string };
export type JobResult = { path: string; name: string; text?: string; kind?: string };

class Unreachable extends Error {}

async function json<T>(r: Response): Promise<T> {
  try {
    return (await r.json()) as T;
  } catch {
    throw new Error(`The server answered with HTTP ${r.status}.`);
  }
}

/** Where to send the task, in order: the VPS (if set), then the website. */
export function jobBases(): string[] {
  const site = `${SITE}/wp-json/fileora/v1`;
  const vps = apiBase();
  return vps ? [`${vps}/app/v1`, site] : [site];
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
  // a gateway error from the VPS itself (down, restarting): try the next address
  if (r.status === 502 || r.status === 504) throw new Unreachable(`The processing server isn’t answering (HTTP ${r.status}).`);
  const created = await json<{ job?: string; token?: string; error?: string; message?: string }>(r);
  if (r.status === 503 && /connected/i.test(created.error ?? '')) throw new Unreachable(created.error ?? 'The server isn’t connected.');
  if (r.status !== 202 || !created.job || !created.token) throw new Error(created.error ?? created.message ?? `The server couldn’t accept this request (error ${r.status}).`);
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
  for (const b of jobBases()) {
    try {
      ({ job, token } = await submit(b, tool, files, options, url));
      base = b;
      break;
    } catch (e) {
      lastErr = e as Error;
      if (!(e instanceof Unreachable)) throw e;
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
    if (st.status === 'failed') throw new Error(st.error ?? 'The server couldn’t process this file.');
  }

  if (st.kind === 'text') {
    // e.g. AI summary: the text comes with the status; it is also saved as a .txt file
    const name = safeName(st.name ?? `${tool}-result.txt`);
    const path = `${BlobUtil.fs.dirs.CacheDir}/${Date.now()}-${name}`;
    await BlobUtil.fs.writeFile(path, st.text ?? '', 'utf8');
    return { path, name, text: st.text, kind: 'text' };
  }
  const name = safeName(st.name ?? `${tool}-result`);
  const path = `${BlobUtil.fs.dirs.CacheDir}/${Date.now()}-${name}`;
  const res = await BlobUtil.config({ path }).fetch('GET', `${base}/jobs/${job}/file`, { 'X-Fileora-Token': token });
  const code = res.info().status;
  if (code !== 200) {
    await BlobUtil.fs.unlink(path).catch(() => {});
    throw new Error(code === 410 ? 'The result was already downloaded. Please run the task again.' : `Download failed (HTTP ${code}).`);
  }
  return { path: stripScheme(res.path() ?? path), name };
}
