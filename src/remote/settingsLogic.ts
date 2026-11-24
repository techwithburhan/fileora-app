/**
 * App Center's Notification & Privacy settings, as plain functions (no phone APIs), so they can be
 * tested: how a setting is shown (show / fix / hide / disable) and what value the app uses.
 */
import type { Control, ControlKey, Prefs, SettingCtl, SettingKey } from './remote';

export const TOPIC_KEYS = ['updates', 'news', 'tools', 'offers', 'blog'];

/** Plugin 2.16+ sends a mode per setting; for older plugins it is made from the 2.14 controls. */
export function resolveCtl(k: SettingKey, own: Partial<Record<SettingKey, SettingCtl>> | null | undefined, legacy: (key: ControlKey) => Control): SettingCtl {
  const o = own?.[k];
  if (o) return o;
  if (TOPIC_KEYS.includes(k)) {
    const t = legacy('topics');
    return { mode: t.allow ? 'show' : 'hide', value: true };
  }
  if (k === 'check' || k === 'sound') return { mode: 'show', value: null };
  const x = legacy(k as ControlKey);
  return { mode: x.allow ? 'show' : 'hide', value: x.def };
}

/**
 * The person's choices with App Center's settings applied: Fixed and Hidden use App Center's
 * value, Disabled is off, and with Show the person's own choice counts once they made one
 * (until then App Center's value is the starting choice).
 */
export function applyCtl(p: Prefs, ctl: (k: SettingKey) => SettingCtl, topicIds: string[]): Prefs {
  const touched = p.touched ?? [];
  const val = (k: SettingKey, own: boolean): boolean => {
    const c = ctl(k);
    if (c.mode === 'disable') return false;
    if (c.mode === 'hide' || c.mode === 'fix') return c.value ?? own;
    return touched.includes(k) || c.value === null ? own : c.value;
  };
  const topics: Record<string, boolean> = { ...p.topics };
  for (const id of topicIds) topics[id] = val(id as SettingKey, p.topics[id] !== false);
  return { ...p, notify: val('notify', p.notify), quiet: val('quiet', p.quiet), private: val('private', p.private), usage: val('usage', p.usage), topics };
}

/** Choices saved by app 0.8 or older have no "touched" list: every value that differs from the default was a choice. */
export function touchedFromOld(p: Prefs, d: Prefs): string[] {
  const out: string[] = [];
  for (const k of ['notify', 'quiet', 'private', 'usage'] as const) if (p[k] !== d[k]) out.push(k);
  for (const id of Object.keys(d.topics)) if ((p.topics[id] !== false) !== (d.topics[id] !== false)) out.push(id);
  return out;
}

/** Whether an alert is kept: newer than `hours`, after an admin's "Clear all", not deleted by an admin. */
export function alertKept(i: { id: string; at: number }, nowSec: number, purge: { hours: number; ids: string[]; before: number }): boolean {
  return i.at > nowSec - purge.hours * 3600 && i.at > purge.before && !purge.ids.includes(i.id);
}
