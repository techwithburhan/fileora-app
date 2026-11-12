/**
 * Runs a Fileora server tool through the website's public REST API (same as the website):
 * upload → poll the status with the task token → download the result once.
 * No key is involved: WordPress adds it when it forwards the task to the processing server.
 */
import BlobUtil from 'react-native-blob-util';
import { SITE } from '../config';
import { safeName, stripScheme } from '../store/files';

export type JobStatus = { status: 'queued' | 'running' | 'done' | 'failed'; ahead?: number; name?: string; size?: number; error?: string; kind?: string; text?: string };

async function json<T>(r: Response): Promise<T> {
  try {
    return (await r.json()) as T;
  } catch {
    throw new Error(`The server answered with HTTP ${r.status}.`);
  }
}

export async function runServerTool(
  tool: string,
  files: { uri: string; name: string; mime: string }[],
  options: Record<string, unknown>,
  onStatus: (s: JobStatus) => void,
  signal?: { cancelled: boolean },
): Promise<{ path: string; name: string; text?: string }> {
  const form = new FormData();
  for (const f of files) {
    const uri = f.uri.startsWith('/') ? `file://${f.uri}` : f.uri;
    form.append('files[]', { uri, name: f.name, type: f.mime } as unknown as Blob);
  }
  form.append('options', JSON.stringify(options));

  const sub = await fetch(`${SITE}/wp-json/fileora/v1/jobs/${tool}`, { method: 'POST', body: form, headers: { Accept: 'application/json' } });
  const created = await json<{ job?: string; token?: string; error?: string }>(sub);
  if (!sub.ok || !created.job || !created.token) throw new Error(created.error ?? `The task couldn’t start (HTTP ${sub.status}).`);
  const headers = { 'X-Fileora-Token': created.token, Accept: 'application/json' };

  let st: JobStatus = { status: 'queued' };
  let wait = 1000;
  const started = Date.now();
  while (st.status !== 'done') {
    if (signal?.cancelled) throw new Error('Cancelled.');
    if (Date.now() - started > 15 * 60000) throw new Error('The task took too long. Please try again.');
    await new Promise<void>(res => setTimeout(() => res(), wait));
    wait = Math.min(wait + 500, 3000);
    const r = await fetch(`${SITE}/wp-json/fileora/v1/jobs/${created.job}`, { headers });
    st = await json<JobStatus>(r);
    if (!r.ok && !st.status) throw new Error(st.error ?? `Status check failed (HTTP ${r.status}).`);
    onStatus(st);
    if (st.status === 'failed') throw new Error(st.error ?? 'The task failed.');
  }

  if (st.kind === 'text') {
    // e.g. AI summary: the text comes with the status; save it as a .txt file
    const name = safeName(st.name ?? `${tool}-result.txt`);
    const path = `${BlobUtil.fs.dirs.CacheDir}/${Date.now()}-${name}`;
    await BlobUtil.fs.writeFile(path, st.text ?? '', 'utf8');
    return { path, name, text: st.text };
  }
  const name = safeName(st.name ?? `${tool}-result`);
  const path = `${BlobUtil.fs.dirs.CacheDir}/${Date.now()}-${name}`;
  const res = await BlobUtil.config({ path }).fetch('GET', `${SITE}/wp-json/fileora/v1/jobs/${created.job}/file`, { 'X-Fileora-Token': created.token });
  const code = res.info().status;
  if (code !== 200) {
    await BlobUtil.fs.unlink(path).catch(() => {});
    throw new Error(code === 410 ? 'The result was already downloaded. Please run the task again.' : `Download failed (HTTP ${code}).`);
  }
  return { path: stripScheme(res.path() ?? path), name };
}
