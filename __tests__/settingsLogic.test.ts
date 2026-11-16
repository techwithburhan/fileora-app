import { alertKept, applyCtl, resolveCtl, touchedFromOld } from '../src/remote/settingsLogic';
import type { Control, ControlKey, Prefs, SettingCtl, SettingKey } from '../src/remote/remote';

const TOPICS = ['updates', 'news', 'tools', 'offers', 'blog'];
const defaults = (): Prefs => ({ notify: true, topics: Object.fromEntries(TOPICS.map(t => [t, true])), askedAt: 0, usage: true, quiet: false, private: false, touched: [] });
const legacyOpen = (): Control => ({ allow: true, def: null });
const legacy = (over: Partial<Record<ControlKey, Control>> = {}) => (k: ControlKey): Control =>
  over[k] ?? ({ notify: { allow: true, def: true }, quiet: { allow: true, def: false }, private: { allow: true, def: false }, usage: { allow: true, def: true } } as Record<string, Control>)[k] ?? legacyOpen();
const ctl = (m: Partial<Record<SettingKey, SettingCtl>>) => (k: SettingKey) => resolveCtl(k, m, legacy());

describe('App Center modes', () => {
  test('show: the person’s choice counts once made; before that App Center’s starting value', () => {
    const c = ctl({ quiet: { mode: 'show', value: true } });
    expect(applyCtl(defaults(), c, TOPICS).quiet).toBe(true); // not chosen yet: starting value
    const chose = { ...defaults(), quiet: false, touched: ['quiet'] };
    expect(applyCtl(chose, c, TOPICS).quiet).toBe(false); // the person turned it off
  });
  test('fix and hide use App Center’s value whatever the person chose', () => {
    const p = { ...defaults(), quiet: false, usage: true, touched: ['quiet', 'usage'] };
    const r = applyCtl(p, ctl({ quiet: { mode: 'fix', value: true }, usage: { mode: 'hide', value: false } }), TOPICS);
    expect(r.quiet).toBe(true);
    expect(r.usage).toBe(false);
  });
  test('disable is always off', () => {
    const r = applyCtl({ ...defaults(), touched: ['notify'] }, ctl({ notify: { mode: 'disable', value: true } }), TOPICS);
    expect(r.notify).toBe(false);
  });
  test('a hidden category with value off is off; others follow the person', () => {
    const p = { ...defaults(), topics: { ...defaults().topics, blog: false }, touched: ['blog'] };
    const r = applyCtl(p, ctl({ offers: { mode: 'hide', value: false } }), TOPICS);
    expect(r.topics.offers).toBe(false);
    expect(r.topics.blog).toBe(false);
    expect(r.topics.news).toBe(true);
  });
  test('older plugin: locked categories (2.14) are hidden and on', () => {
    const c = (k: SettingKey) => resolveCtl(k, null, legacy({ topics: { allow: false, def: null } }));
    expect(c('offers')).toEqual({ mode: 'hide', value: true });
    expect(c('check')).toEqual({ mode: 'show', value: null });
    const r = applyCtl({ ...defaults(), topics: { ...defaults().topics, offers: false }, touched: ['offers'] }, c, TOPICS);
    expect(r.topics.offers).toBe(true);
  });
  test('older plugin, nothing locked: behaves as before', () => {
    const c = (k: SettingKey) => resolveCtl(k, null, legacy());
    const p = { ...defaults(), quiet: true, touched: ['quiet'] };
    expect(applyCtl(p, c, TOPICS)).toEqual(p);
  });
});

describe('upgrade from app 0.8', () => {
  test('choices that differ from the defaults are kept as the person’s own', () => {
    const old = { ...defaults(), quiet: true, topics: { ...defaults().topics, offers: false } };
    expect(touchedFromOld(old, defaults()).sort()).toEqual(['offers', 'quiet']);
  });
});

describe('alerts', () => {
  const now = 1_800_000_000;
  const pg = { hours: 72, ids: ['gone'], before: 0 };
  test('kept for 72 hours, then deleted', () => {
    expect(alertKept({ id: 'a', at: now - 71 * 3600 }, now, pg)).toBe(true);
    expect(alertKept({ id: 'a', at: now - 73 * 3600 }, now, pg)).toBe(false);
  });
  test('deleted by an admin, one or all', () => {
    expect(alertKept({ id: 'gone', at: now - 60 }, now, pg)).toBe(false);
    expect(alertKept({ id: 'b', at: now - 60 }, now, { ...pg, before: now - 30 })).toBe(false);
    expect(alertKept({ id: 'c', at: now - 10 }, now, { ...pg, before: now - 30 })).toBe(true);
  });
});
