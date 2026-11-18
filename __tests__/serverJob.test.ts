/**
 * App 1.0: a server tool must work on the first tap even when the VPS app gateway is off.
 * Before, the gateway's 404 ("Not found.") ended the task; now the task goes to the website.
 */
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: { dirs: { CacheDir: '/cache' }, writeFile: jest.fn(async () => {}), unlink: jest.fn(async () => {}) },
    config: () => ({ fetch: async () => ({ info: () => ({ status: 200 }), path: () => '/cache/out.pdf' }) }),
  },
}));
jest.mock('../src/config', () => ({ SITE: 'https://www.example.in' }));
jest.mock('../src/remote/remote', () => ({ apiBase: () => 'https://api.example.in' }));
jest.mock('../src/store/files', () => ({ safeName: (n: string) => n, stripScheme: (p: string) => p }));

import { runServerTool, jobBases, NeedPassword } from '../src/lib/serverJob';

type Call = { url: string; method: string };
function mockFetch(answers: ((c: Call) => { status: number; body?: unknown } | undefined)[]) {
  const calls: Call[] = [];
  (global as unknown as { fetch: unknown }).fetch = jest.fn(async (url: string, init?: { method?: string }) => {
    const c = { url, method: init?.method ?? 'GET' };
    calls.push(c);
    for (const a of answers) {
      const r = a(c);
      if (r) return { status: r.status, ok: r.status < 400, json: async () => r.body ?? {} };
    }
    throw new Error('network');
  });
  return calls;
}
const file = [{ uri: '/tmp/a.docx', name: 'a.docx', mime: 'application/msword' }];
const FastTimers = () => jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0; }) as unknown as typeof setTimeout);

beforeEach(() => FastTimers());
afterEach(() => jest.restoreAllMocks());

test('gateway off (404 "Not found.") -> the website runs the task, first try', async () => {
  const calls = mockFetch([
    c => (c.url.startsWith('https://api.example.in/app/v1/jobs/') && c.method === 'POST' ? { status: 404, body: { error: 'Not found.' } } : undefined),
    c => (c.url.endsWith('/wp-json/fileora/v1/jobs/word2pdf') && c.method === 'POST' ? { status: 202, body: { job: 'j1', token: 't1' } } : undefined),
    c => (c.url.includes('/wp-json/fileora/v1/jobs/j1?') ? { status: 200, body: { status: 'done', name: 'a.pdf', kind: 'file' } } : undefined),
  ]);
  const res = await runServerTool('word2pdf', file, {}, () => {});
  expect(res.name).toBe('a.pdf');
  expect(calls[0].url).toContain('api.example.in/app/v1/jobs/word2pdf');
  expect(calls[1].url).toContain('www.example.in/wp-json/fileora/v1/jobs/word2pdf');
  // the gateway is skipped for a while: the next task goes straight to the website
  expect(jobBases()).toEqual(['https://www.example.in/wp-json/fileora/v1']);
});

test('a locked PDF -> NeedPassword (the screen asks for it)', async () => {
  mockFetch([
    c => (c.method === 'POST' ? { status: 202, body: { job: 'j2', token: 't2' } } : undefined),
    c => (c.url.includes('/jobs/j2?') ? { status: 200, body: { status: 'failed', error: 'a.pdf is password-protected.', need: 'password' } } : undefined),
  ]);
  await expect(runServerTool('ocr', file, {}, () => {})).rejects.toBeInstanceOf(NeedPassword);
});

test('a first connection that fails is tried again', async () => {
  let n = 0;
  mockFetch([
    c => (c.method === 'POST' && n++ === 0 ? { status: 502 } : undefined),
    c => (c.method === 'POST' ? { status: 202, body: { job: 'j3', token: 't3' } } : undefined),
    c => (c.url.includes('/jobs/j3?') ? { status: 200, body: { status: 'done', name: 'b.pdf', kind: 'file' } } : undefined),
  ]);
  const res = await runServerTool('pdf2word', file, {}, () => {});
  expect(res.name).toBe('b.pdf');
});
