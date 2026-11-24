/**
 * Festival animations from App Center (plugin 2.24): each festival's own particle layers and the
 * shapes they use, checked before the app draws them (no app code depends on a festival's name).
 */
/** One layer of a festival animation: shape, mode, colours, count, size range (px), speed. */
export type FxLayer = { s: string; m: 'fall' | 'rise' | 'drift' | 'twinkle' | 'sway' | 'burst' | 'splash'; c: string[]; n: number; z: [number, number]; sp: number };
/** A particle shape: SVG path(s) in a -1..1 box. */
export type FxShape = { d: string; d2?: string; c2?: string; rule?: 'evenodd' | 'nonzero'; rule2?: 'evenodd' | 'nonzero'; glow?: number };
export type FestivalFx = { layers: FxLayer[]; shapes: Record<string, FxShape> };

const hex = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : '');
const FX_MODES = ['fall', 'rise', 'drift', 'twinkle', 'sway', 'burst', 'splash'];
const colourOrRgba = (v: unknown) => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\))$/i.test(v) ? v : '');
const pathData = (v: unknown) => (typeof v === 'string' && v.length < 4000 && /^[MLCQAZHV0-9.,\s-]+$/i.test(v) ? v : '');
/** The festival's own animation from App Center (plugin 2.24), checked: at most 4 layers, known modes, plain path data. */
export function cleanFx(v: unknown): FestivalFx | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as { layers?: unknown; shapes?: unknown };
  const shapes: Record<string, FxShape> = {};
  if (o.shapes && typeof o.shapes === 'object') {
    for (const [k, raw] of Object.entries(o.shapes as Record<string, unknown>).slice(0, 8)) {
      const sh = raw as Record<string, unknown>;
      const d = pathData(sh?.d);
      if (!/^[a-z0-9]{2,16}$/.test(k) || !d) continue;
      shapes[k] = {
        d,
        d2: pathData(sh.d2) || undefined,
        c2: colourOrRgba(sh.c2) || undefined,
        rule: sh.rule === 'evenodd' ? 'evenodd' : undefined,
        rule2: sh.rule2 === 'evenodd' ? 'evenodd' : undefined,
        glow: sh.glow ? 1 : undefined,
      };
    }
  }
  const layers: FxLayer[] = [];
  for (const raw of Array.isArray(o.layers) ? o.layers.slice(0, 4) : []) {
    const l = raw as Record<string, unknown>;
    const m = String(l?.m ?? '');
    const s = String(l?.s ?? '');
    if (!FX_MODES.includes(m) || (!shapes[s] && m !== 'burst' && m !== 'splash')) continue;
    const c = (Array.isArray(l.c) ? l.c : []).map(hex).filter(Boolean).slice(0, 6);
    const z = Array.isArray(l.z) ? l.z.map(Number) : [];
    layers.push({
      s,
      m: m as FxLayer['m'],
      c: c.length ? c : ['#FFFFFF'],
      n: Math.max(1, Math.min(40, Math.round(Number(l.n) || 12))),
      z: [Math.max(1, Math.min(120, z[0] || 8)), Math.max(1, Math.min(140, z[1] || z[0] || 14))],
      sp: Math.max(0.3, Math.min(2, Number(l.sp) || 1)),
    });
  }
  return layers.length ? { layers, shapes } : null;
}
