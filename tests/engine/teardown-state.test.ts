import { describe, it, expect } from 'vitest';
import { teardownState, stageProgress, slabHeights, entropyNote, barLengths, STATES, STATE_COUNT, T, W, type Layers } from '../../src/engine/motion/teardown-state';

const at = (k: number) => k / STATE_COUNT;
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('teardownState: the 7 states', () => {
  it('names them, each with one meaning from the motion vocabulary', () => {
    expect(STATES.map((s) => s.name)).toEqual(['SEALED', 'CRACK', 'DETONATE', 'DISTILL', 'DECIDE', 'EXPLAIN', 'MAP']);
    expect(STATES.map((s) => s.meaning)).toEqual(['state', 'hierarchy', 'flow', 'cause', 'change', 'cause', 'dependency']);
  });

  it('maps progress to the state index at every boundary', () => {
    for (let k = 0; k < STATE_COUNT; k++) {
      expect(teardownState(at(k)).index, `start of ${k}`).toBe(k);
      expect(teardownState(at(k) + 1e-6).index).toBe(k);
      expect(teardownState(at(k + 1) - 1e-6).index).toBe(k);
    }
    expect(teardownState(1).index).toBe(6);
  });

  it('SEALED (p=0): one solid block, hash not yet settled, everything else off', () => {
    const l = teardownState(0);
    expect(l.slabs).toEqual({ opacity: 1, gap: 0, labels: 0 });
    expect(l.hash.settle).toBe(0);
    for (const k of ['stream', 'grid', 'model', 'verdict', 'explain', 'map'] as const) expect((l[k] as { opacity: number }).opacity, k).toBe(0);
  });

  it('the hash has settled by the middle of SEALED', () => {
    near(teardownState(0.5 * W).hash.settle, 1);
    expect(teardownState(0.25 * W).hash.settle).toBeGreaterThan(0.5); // ease-out: most of it lands early
  });

  it('CRACK opens the block a quarter of the way and shows the labels', () => {
    near(teardownState(T(1).e).slabs.gap, 0.25);
    near(teardownState(T(1).e).slabs.labels, 1);
    near(teardownState(T(1).s).slabs.gap, 0);
  });

  it('DETONATE pulls the slabs fully apart and runs the API stream and its total to the end', () => {
    near(teardownState(T(2).e).slabs.gap, 1);
    const mid = teardownState((T(2).s + T(2).e) / 2);
    expect(mid.stream.opacity).toBe(1);
    expect(mid.stream.bars).toBeGreaterThan(0.3);
    expect(mid.stream.bars).toBeLessThan(0.7);
    near(teardownState(T(2).e).stream.total, 1);
  });

  it('DISTILL: the stream gives way to the 54-cell grid, which is assembled by the end of the window', () => {
    near(teardownState(T(3).s).grid.assemble, 0);
    near(teardownState(T(3).e).grid.assemble, 1);
    expect(teardownState(3.3 * W).slabs.opacity).toBeLessThan(0.5);
    expect(teardownState(3.3 * W).grid.opacity).toBe(1);
  });

  it('DECIDE: cells converge into the model node, then the verdict is revealed', () => {
    near(teardownState(T(4).s).grid.converge, 0);
    near(teardownState(T(4).e).grid.converge, 1);
    expect(teardownState(T(4).s + 0.5 * W).model.opacity).toBe(1);
    near(teardownState(T(4).e).verdict.reveal, 1);
    expect(teardownState(T(4).e).verdict.opacity).toBe(1);
    expect(teardownState(T(4).s).verdict.opacity).toBe(0);
  });

  it('EXPLAIN: the verdict docks and the contribution bars grow', () => {
    near(teardownState(T(5).s).verdict.dock, 0);
    near(teardownState(T(5).e).verdict.dock, 1);
    near(teardownState(T(5).s).explain.bars, 0);
    near(teardownState(T(5).e).explain.bars, 1);
    expect(teardownState(5.3 * W).explain.opacity).toBe(1);
  });

  it('MAP: ATT&CK tags lock in; at the end only the verdict and the map are left', () => {
    near(teardownState(T(6).s).map.locked, 0);
    near(teardownState(1).map.locked, 1);
    expect(teardownState(1).map.opacity).toBe(1);
    expect(teardownState(1).verdict.opacity).toBe(1);
    expect(teardownState(1).slabs.opacity).toBe(0);
    expect(teardownState(1).grid.opacity).toBe(0);
    expect(teardownState(1).explain.opacity).toBe(0);
  });

  it('local runs 0..1 inside each state', () => {
    for (let k = 0; k < STATE_COUNT; k++) {
      near(teardownState(at(k)).local, 0);
      near(teardownState(at(k + 0.5)).local, 0.5);
    }
    near(teardownState(1).local, 1);
  });
});

describe('teardownState: invariants', () => {
  const flat = (l: Layers) => [l.hash.settle, l.slabs.opacity, l.slabs.gap, l.slabs.labels, l.stream.opacity, l.stream.bars, l.stream.total, l.grid.opacity, l.grid.assemble, l.grid.converge, l.model.opacity, l.verdict.opacity, l.verdict.reveal, l.verdict.dock, l.explain.opacity, l.explain.bars, l.map.opacity, l.map.locked];

  it('every value stays within 0..1 for any progress, including garbage', () => {
    for (const p of [-5, -0.001, 0, 0.123, 0.5, 0.999, 1, 1.5, NaN, Infinity, -Infinity])
      flat(teardownState(p)).forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); });
  });

  it('is continuous: no value jumps more than a sliver between neighbouring scroll positions', () => {
    let prev = flat(teardownState(0));
    for (let i = 1; i <= 7000; i++) {
      const cur = flat(teardownState(i / 7000));
      cur.forEach((v, j) => expect(Math.abs(v - prev[j]), `value ${j} at ${i / 7000}`).toBeLessThan(0.04)); // the verdict's stamp is the one fast edge on the page
      prev = cur;
    }
  });

  it('is reversible: the same progress always gives the same layers, so scrolling back reassembles', () => {
    const forward = [0.1, 0.4, 0.8, 0.95].map((p) => JSON.stringify(teardownState(p)));
    const back = [0.95, 0.8, 0.4, 0.1].map((p) => JSON.stringify(teardownState(p))).reverse();
    expect(back).toEqual(forward);
  });

  it('the slab gap never closes once opened going forward, and only the stream/grid layers leave', () => {
    let gap = 0;
    for (let i = 0; i <= 700; i++) { const g = teardownState(i / 700).slabs.gap; expect(g).toBeGreaterThanOrEqual(gap); gap = g; }
  });
});

describe('stage geometry helpers', () => {
  it('stageProgress is 0 at the top of the stage and 1 when its bottom reaches the viewport bottom', () => {
    expect(stageProgress(0, 6000, 1000)).toBe(0);
    expect(stageProgress(100, 6000, 1000)).toBe(0);
    expect(stageProgress(-2500, 6000, 1000)).toBe(0.5);
    expect(stageProgress(-5000, 6000, 1000)).toBe(1);
    expect(stageProgress(-9000, 6000, 1000)).toBe(1);
    expect(stageProgress(0, 800, 1000)).toBe(0);
  });

  it('slabHeights: proportional to size, floored for the tiny sections, summing to the stack height', () => {
    const sizes = [28672, 24576, 8192, 3448832];
    const h = slabHeights(sizes, 400, 6);
    expect(h.slice(0, 3)).toEqual([6, 6, 6]);
    expect(h.reduce((a, b) => a + b, 0)).toBeCloseTo(400, 9);
    expect(h[3]).toBeCloseTo(382, 9);
    expect(slabHeights([100, 100], 200, 6)).toEqual([100, 100]);
    expect(slabHeights([], 200, 6)).toEqual([]);
    expect(slabHeights([0, 0], 200, 6)).toEqual([0, 0]);
  });

  it('entropy above 7.0 is HIGH ENTROPY, never "packed"', () => {
    expect([6.4, 6.66, 4.46, 7.0].map(entropyNote)).toEqual([null, null, null, null]);
    expect(entropyNote(7.01)).toBe('HIGH ENTROPY');
    expect(entropyNote(8)).toBe('HIGH ENTROPY');
    expect(String(entropyNote(8))).not.toMatch(/pack/i);
  });

  it('barLengths scale to the largest magnitude, ignoring sign', () => {
    expect(barLengths([10, 5, -10, 0])).toEqual([1, 0.5, 1, 0]);
    expect(barLengths([0, 0])).toEqual([0, 0]);
    expect(barLengths([])).toEqual([]);
  });
});
