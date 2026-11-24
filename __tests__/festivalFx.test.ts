import { cleanFx } from '../src/festival/fxData';
// animations exactly as plugin 2.24 sends them in app-config (generated from the plugin's visual library)
import fixture from './festival-fx.fixture.json';

describe('festival animations from App Center', () => {
  test('every festival animation in the fixture is accepted with its shapes', () => {
    for (const [id, raw] of Object.entries(fixture)) {
      const fx = cleanFx(raw);
      expect(fx).not.toBeNull();
      for (const l of fx!.layers) {
        if (l.m !== 'burst' && l.m !== 'splash') expect(fx!.shapes[l.s]).toBeDefined();
        expect(l.c.length).toBeGreaterThan(0);
      }
      expect(id.length).toBeGreaterThan(0);
    }
  });
  test('different festivals bring different animations', () => {
    const sig = Object.values(fixture).map(raw => cleanFx(raw)!.layers.map(l => `${l.s}:${l.m}`).join(' '));
    expect(new Set(sig).size).toBe(sig.length);
  });
  test('unknown modes, script-like paths and bad colours are dropped', () => {
    const fx = cleanFx({
      layers: [
        { s: 'x1', m: 'explode', c: ['#FFFFFF'], n: 5, z: [4, 8], sp: 1 },
        { s: 'bad', m: 'fall', c: ['red'], n: 5, z: [4, 8], sp: 1 },
        { s: 'ok', m: 'fall', c: ['#ff0000', 'javascript:1'], n: 500, z: [4, 999], sp: 9 },
      ],
      shapes: { x1: { d: 'M0 0Z' }, bad: { d: '<script>' }, ok: { d: 'M0 -1A1 1 0 1 1 0 1Z', c2: 'url(x)' } },
    });
    expect(fx!.layers).toHaveLength(1);
    expect(fx!.layers[0]).toEqual({ s: 'ok', m: 'fall', c: ['#FF0000'], n: 40, z: [4, 140], sp: 2 });
    expect(fx!.shapes.ok.c2).toBeUndefined();
    expect(fx!.shapes.bad).toBeUndefined();
  });
  test('nothing usable gives no animation', () => {
    expect(cleanFx(null)).toBeNull();
    expect(cleanFx({ layers: [], shapes: {} })).toBeNull();
  });
});
