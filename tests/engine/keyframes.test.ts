import { describe, it, expect } from 'vitest';
import { sample, keyProblem, EASES, type Key } from '../../src/engine/motion/keyframes';
import { TRACKS, T, W, OVERLAP, STATE_COUNT } from '../../src/engine/motion/teardown-state';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('easing', () => {
  it('every ease runs 0 -> 1 and is monotone', () => {
    for (const [name, f] of Object.entries(EASES)) {
      near(f(0), 0); near(f(1), 1);
      let prev = 0;
      for (let i = 1; i <= 100; i++) { const v = f(i / 100); expect(v, name).toBeGreaterThanOrEqual(prev - 1e-12); prev = v; }
    }
  });
  it('ease-in-out cubic is slow at both ends and fastest in the middle', () => {
    expect(EASES.inout(0.1)).toBeLessThan(0.01);
    near(EASES.inout(0.5), 0.5);
    expect(EASES.inout(0.9)).toBeGreaterThan(0.99);
  });
});

describe('sample', () => {
  const keys: Key[] = [[0.2, 10], [0.4, 30], [0.8, 0, 'linear']];
  it('holds before the first key and after the last', () => { expect(sample(keys, 0)).toBe(10); expect(sample(keys, 0.2)).toBe(10); expect(sample(keys, 1)).toBe(0); });
  it('hits every key value exactly', () => { expect(sample(keys, 0.4)).toBe(30); expect(sample(keys, 0.8)).toBe(0); });
  it('uses the arriving key\'s ease per segment: default ease-in-out, then linear', () => {
    near(sample(keys, 0.3), 20);           // ease-in-out midpoint of 10 -> 30
    near(sample(keys, 0.6), 15);           // linear midpoint of 30 -> 0
    expect(sample(keys, 0.25)).toBeLessThan(sample([[0.2, 10], [0.4, 30, 'linear']], 0.25)); // eased start is slower than linear
  });
  it('is continuous across every key', () => {
    for (const [at] of keys) expect(Math.abs(sample(keys, at + 1e-9) - sample(keys, at - 1e-9))).toBeLessThan(1e-4);
  });
  it('rejects keys that do not strictly increase', () => {
    expect(keyProblem([[0, 0], [0.5, 1], [0.5, 2]])).toMatch(/not after/);
    expect(keyProblem([[0.5, 0], [0.2, 1]])).toMatch(/not after/);
    expect(keyProblem([])).toBe('no keys');
    expect(keyProblem(keys)).toBeNull();
  });
});

describe('the teardown timeline', () => {
  it('every track is well formed', () => { for (const [name, keys] of Object.entries(TRACKS)) expect(keyProblem(keys), name).toBeNull(); });

  it('every value stays within 0..1', () => {
    for (const [name, keys] of Object.entries(TRACKS)) for (let i = 0; i <= 1000; i++) {
      const v = sample(keys, i / 1000);
      expect(v, name).toBeGreaterThanOrEqual(0); expect(v, name).toBeLessThanOrEqual(1);
    }
  });

  it('transition windows are one state plus 15% long, centred on the boundary', () => {
    for (let k = 1; k <= 5; k++) {
      const w = T(k);
      near(w.e - w.s, W + OVERLAP);
      near((w.s + w.e) / 2, k * W);
    }
    near(T(1).s, 0.5 * W - OVERLAP / 2);
  });

  it('neighbouring windows overlap by 15% of a state, so nothing waits for the last thing to finish', () => {
    for (let k = 1; k < 6; k++) {
      const overlap = T(k).e - T(k + 1).s;
      near(overlap / W, 0.15);
      expect(overlap).toBeGreaterThan(0);
    }
  });

  it('the last window ends just before the end of the scroll (a short rest to read the map); the first state has no entrance', () => {
    expect(T(6).e).toBeLessThan(1);
    expect(1 - T(6).e).toBeLessThan(W / 2);
    expect(T(0).s).toBe(0);
  });

  it('inside an overlap, the old layer is still going while the next one has started', () => {
    // CRACK (T1) is still opening the slabs when DETONATE's stream (T2) starts to appear
    const p = (T(1).e + T(2).s) / 2;
    expect(p).toBeLessThan(T(1).e);
    expect(p).toBeGreaterThan(T(2).s);
    expect(sample(TRACKS.slabsGap, p)).toBeGreaterThan(0.2);
    expect(sample(TRACKS.slabsGap, p)).toBeLessThanOrEqual(1);
    expect(sample(TRACKS.streamOpacity, p)).toBeGreaterThan(0);
    // and DISTILL's grid is already arriving while the stream is still leaving
    const q = T(3).s + 0.3 * W;
    expect(sample(TRACKS.gridOpacity, q)).toBeGreaterThan(0.5);
    expect(sample(TRACKS.streamOpacity, q)).toBeGreaterThan(0);
  });

  it('boundary values: sealed at 0, fully exploded after DETONATE, only the map left at the end', () => {
    expect(sample(TRACKS.slabsGap, 0)).toBe(0);
    near(sample(TRACKS.slabsGap, T(1).e), 0.25);
    near(sample(TRACKS.slabsGap, T(2).e), 1);
    expect(sample(TRACKS.slabsOpacity, 1)).toBe(0);
    expect(sample(TRACKS.gridOpacity, 1)).toBe(0);
    near(sample(TRACKS.mapLocked, 1), 1);
    near(sample(TRACKS.verdictDock, T(5).e), 1);
    near(sample(TRACKS.verdictReveal, T(4).e), 1);
  });

  it('there are seven states', () => expect(STATE_COUNT).toBe(7));
});
