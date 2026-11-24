/**
 * App 1.2: the Alerts history. The website's copy (whole message) and the phone's own copy are
 * merged into one alert; "only older versions" alerts are hidden from the latest and newer apps.
 */
jest.mock('react-native-blob-util', () => ({ __esModule: true, default: { fs: { dirs: { DocumentDir: '/d', LibraryDir: '/l', CacheDir: '/c', DownloadDir: '/dl' }, unlink: async () => {} } } }));
jest.mock('../src/store/files', () => ({ DATA: '/d/fileora', ensureDirs: async () => {} }));
jest.mock('../src/lib/safeFile', () => ({ onFlush: () => {}, readJsonSafe: async () => null, writeJsonSafe: async () => {} }));

import { forMe, mergeInbox } from '../src/remote/inbox';
import type { InboxItem } from '../src/remote/remote';

const item = (id: string, over: Partial<InboxItem> = {}): InboxItem => ({ id, title: 'T ' + id, body: 'short…', image: '', open: 'home', tool: '', link: '', topic: 'all', older: '', at: 1000, ...over });

describe('Alerts history', () => {
  it('lists a notification once, with the whole message from the website and the time it arrived', () => {
    const phone = [item('a', { at: 2000, body: 'First 300 characters…', image: 'https://x/img.jpg' })];
    const site = [item('a', { at: 1990, body: 'The whole message, much longer than 300 characters.' }), item('b')];
    const out = mergeInbox(phone, site);
    expect(out).toHaveLength(2);
    const a = out.find(i => i.id === 'a')!;
    expect(a.body).toBe('The whole message, much longer than 300 characters.');
    expect(a.at).toBe(2000);
    expect(a.image).toBe('https://x/img.jpg');
  });
  it('keeps alerts that arrived only on the phone (background, Firebase Console)', () => {
    expect(mergeInbox([item('p')], []).map(i => i.id)).toEqual(['p']);
  });
  it('hides "only older versions" alerts from the latest and newer apps', () => {
    const upd = item('u', { older: '1.2.0' });
    expect(forMe(upd, '1.1.2', {})).toBe(true);
    expect(forMe(upd, '1.2.0', {})).toBe(false);
    expect(forMe(upd, '1.3.0', {})).toBe(false);
  });
  it('respects the categories switched off', () => {
    expect(forMe(item('o', { topic: 'offers' }), '1.2.0', { offers: false })).toBe(false);
    expect(forMe(item('o', { topic: 'offers' }), '1.2.0', { offers: true })).toBe(true);
    expect(forMe(item('i', { topic: 'all' }), '1.2.0', { offers: false })).toBe(true);
  });
});
