/** Numbers for Home (recently used, popular, charts) worked out from the usage history. */
import { CATEGORIES, CategoryId, POPULAR, Tool, toolById } from '../data/tools';
import type { UsageEvent } from './store';

export function recentTools(events: UsageEvent[], n = 8): Tool[] {
  const seen = new Set<string>();
  const out: Tool[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < n; i--) {
    const id = events[i].tool;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = toolById(id);
    if (t) out.push(t);
  }
  return out;
}

/** Most used tools in the last 60 days (a finished task counts 3, an open 1); filled up with the usual favourites. */
export function popularTools(events: UsageEvent[], n = 8): { tools: Tool[]; personal: boolean } {
  const since = Date.now() - 60 * 86400000;
  const score = new Map<string, number>();
  for (const e of events) if (e.t >= since) score.set(e.tool, (score.get(e.tool) ?? 0) + (e.type === 'done' ? 3 : 1));
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => toolById(id)).filter((t): t is Tool => !!t);
  const tools = [...ranked];
  for (const t of POPULAR) if (tools.length < n && !tools.includes(t)) tools.push(t);
  return { tools: tools.slice(0, n), personal: ranked.length > 0 };
}

/** Tool uses by category: every use starts by opening a tool, so opens are counted. */
export function categoryUsage(events: UsageEvent[]): { cat: CategoryId; name: string; count: number }[] {
  const c = new Map<CategoryId, number>();
  for (const e of events) {
    if (e.type !== 'open') continue;
    const t = toolById(e.tool);
    if (t) c.set(t.cat, (c.get(t.cat) ?? 0) + 1);
  }
  return CATEGORIES.map(k => ({ cat: k.id, name: k.name, count: c.get(k.id) ?? 0 })).filter(x => x.count > 0);
}

export function dailyBytes(events: UsageEvent[], days = 7): { label: string; date: string; bytes: number }[] {
  const out: { label: string; date: string; bytes: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    out.push({ label: d.toLocaleDateString('en-IN', { weekday: 'short' }), date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), bytes: 0 });
  }
  const start = today.getTime() - (days - 1) * 86400000;
  for (const e of events) {
    if (e.type !== 'done' || !e.bytes || e.t < start) continue;
    const i = Math.floor((e.t - start) / 86400000);
    if (out[i]) out[i].bytes += e.bytes;
  }
  return out;
}

export function totals(events: UsageEvent[]): { tasks: number; bytes: number } {
  let tasks = 0;
  let bytes = 0;
  for (const e of events)
    if (e.type === 'done') {
      tasks++;
      bytes += e.bytes ?? 0;
    }
  return { tasks, bytes };
}
