/**
 * App 1.2: force update. The "Please update" screen must go away as soon as the required version
 * is installed, also with versions written like "v1.2" or "1.2", a minimum above "latest", or force
 * update switched off in App Center.
 */
jest.mock('react-native-blob-util', () => ({ __esModule: true, default: { fs: { dirs: { DocumentDir: '/d', LibraryDir: '/l', CacheDir: '/c', DownloadDir: '/dl' } } } }));
jest.mock('../src/store/files', () => ({ DATA: '/d/fileora', ensureDirs: async () => {} }));
jest.mock('../src/lib/safeFile', () => ({ onFlush: () => {}, readJsonSafe: async () => null, writeJsonSafe: async () => {} }));

import { cmpVersion, mustUpdate, normVersion, requiredVersion } from '../src/remote/remote';

const u = (min: string, latest = '', force = true) => ({ min, latest, url: '', notes: '', force, title: '', message: '' });

describe('versions', () => {
  it('normalises how admins type versions', () => {
    expect(normVersion('v1.2')).toBe('1.2');
    expect(normVersion(' 1.2.0 ')).toBe('1.2.0');
    expect(normVersion('1.2.0-beta')).toBe('1.2.0');
    expect(normVersion('latest')).toBe('');
  });
  it('compares dotted versions', () => {
    expect(cmpVersion('1.2', '1.2.0')).toBe(0);
    expect(cmpVersion('1.10.0', '1.9.9')).toBe(1);
    expect(cmpVersion('1.1.2', '1.2')).toBe(-1);
    expect(cmpVersion('v1.2.0', '1.2')).toBe(0);
  });
});

describe('force update', () => {
  it('blocks an older version (the screenshot: 1.1.2 with minimum 1.2)', () => {
    expect(mustUpdate('1.1.2', u('1.2', '1.2'))).toBe(true);
  });
  it('disappears once the required version is installed', () => {
    expect(mustUpdate('1.2.0', u('1.2', '1.2'))).toBe(false);
    expect(mustUpdate('1.2.1', u('1.2.0', '1.2.1'))).toBe(false);
    expect(mustUpdate('1.2.0', u('v1.2', 'v1.2'))).toBe(false);
  });
  it('never asks for more than the latest version that exists', () => {
    expect(requiredVersion(u('2.0', '1.2.0'))).toBe('1.2.0');
    expect(mustUpdate('1.2.0', u('2.0', '1.2.0'))).toBe(false);
  });
  it('is off when App Center switches it off or has no minimum', () => {
    expect(mustUpdate('1.0.0', u('1.2', '1.2', false))).toBe(false);
    expect(mustUpdate('1.0.0', u('', '1.2'))).toBe(false);
    expect(mustUpdate('1.0.0', null)).toBe(false);
  });
  it('ignores a minimum that is not a version', () => {
    expect(mustUpdate('1.0.0', u('soon', ''))).toBe(false);
  });
});
