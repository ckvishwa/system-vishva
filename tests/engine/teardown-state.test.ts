import { describe, it, expect } from 'vitest';
import { teardownState, stageProgress, slabHeights, entropyNote, barLengths, STATES, STATE_COUNT, TRACKS, STILL, T, W, type Layers } from '../../src/engine/motion/teardown-state';
import { sample } from '../../src/engine/motion/keyframes';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('teardownState: the 8 states', () => {
  it('names them, each with one meaning from the motion vocabulary', () => {
    expect(STATES.map((s) => s.name)).toEqual(['SEALED', 'CRACK', 'DETONATE', 'DISTILL', 'DECIDE', 'EXPLAIN', 'MAP', 'PULL-BACK']);
    expect(STATES.map((s) => s.meaning)).toEqual(['state', 'hierarchy', 'flow', 'cause', 'change', 'cause', 'dependency', 'flow']);
  });

  it('maps progress to the state index at every boundary', () => {
    for (let k = 0; k < STATE_COUNT; k++) {
      expect(teardownState(k * W).index, `start of ${k}`).toBe(k);
      expect(teardownState(k * W + 1e-6).index).toBe(k);
      expect(teardownState((k + 1) * W - 1e-6).index).toBe(k);
    }
    expect(teardownState(1).index).toBe(STATE_COUNT - 1);
  });

  it('SEALED (p=0): a pulled-out camera on one solid block, nothing else on', () => {
    const l = teardownState(0);
    expect(l.cam.scale).toBeLessThan(0.9);
    expect(l.slabs.gap).toBe(0);
    expect(l.slabs.x).toBe(0);
    expect(l.slabs.labels).toBe(0);
    expect(l.hash.settle).toBe(0);
    expect(l.stream.opacity + l.procs.opacity + l.grid.opacity + l.model.opacity + l.verdict.opacity + l.explain.opacity + l.chain.opacity).toBe(0);
    expect(l.pull).toBe(0);
  });

  it('SEALED: the camera pushes in and the hash has settled before CRACK', () => {
    expect(teardownState(0.8 * W).cam.scale).toBe(1);
    near(teardownState(0.6 * W).hash.settle, 1);
    expect(teardownState(0.3 * W).hash.settle).toBeGreaterThan(0.5);
  });

  it('CRACK opens the block a quarter of the way and shows the labels', () => {
    near(teardownState(T(1).e).slabs.gap, 0.25);
    near(teardownState(T(1).e).slabs.labels, 1);
    near(teardownState(T(1).s).slabs.gap, 0);
  });

  it('DETONATE pulls the slabs apart and aside, runs the stream, and grows the process nodes', () => {
    near(teardownState(T(2).e).slabs.gap, 1);
    near(teardownState(T(2).e).slabs.x, 1);
    const mid = teardownState((T(2).s + T(2).e) / 2);
    expect(mid.stream.opacity).toBe(1);
    expect(mid.stream.bars).toBeGreaterThan(0.3);
    expect(mid.stream.bars).toBeLessThan(0.7);
    near(teardownState(T(2).e).stream.bars, 1);
    near(teardownState(T(2).e).procs.grow, 1);
    expect(teardownState(T(2).e).procs.opacity).toBe(1);
  });

  it('DISTILL pulls everything inward and the matrix assembles', () => {
    near(teardownState(T(3).s).pull, 0);
    near(teardownState(T(3).e).pull, 1);
    near(teardownState(T(3).e).grid.assemble, 1);
    expect(teardownState(T(3).e).slabs.opacity).toBe(0);
    expect(teardownState(T(3).e).procs.opacity).toBe(0);
    expect(teardownState(3.4 * W).grid.opacity).toBe(1);
  });

  it('DECIDE: the matrix funnels into the model, then stillness, then the verdict stamps', () => {
    near(teardownState(T(4).s).grid.converge, 0);
    near(teardownState(STILL.s).grid.converge, 1);
    expect(teardownState(STILL.s).grid.opacity).toBe(0);
    expect(teardownState(STILL.s).model.opacity).toBe(1);
    expect(teardownState(STILL.stamp).verdict.opacity).toBe(0);
    near(teardownState(STILL.end).verdict.opacity, 1);
    near(teardownState(STILL.end).verdict.reveal, 1);
    expect(teardownState(STILL.s).cam.scale).toBeGreaterThan(1.05); // the camera has pushed in on the model
  });

  it('EXPLAIN: the verdict docks and the node opens out into the bars', () => {
    near(teardownState(T(5).s).verdict.dock, 0);
    near(teardownState(T(5).e).verdict.dock, 1);
    near(teardownState(T(5).s).explain.open, 0);
    near(teardownState(T(5).e).explain.open, 1);
    near(teardownState(T(5).e).explain.bars, 1);
    expect(teardownState(T(5).e).model.opacity).toBe(0);
  });

  it('MAP: the ATT&CK nodes grow out of the bars', () => {
    near(teardownState(T(6).s).map.grow, 0);
    near(teardownState(T(6).e).map.grow, 1);
    expect(teardownState(T(6).s).explain.opacity).toBe(1);               // the bars are there for the nodes to grow out of...
    expect(teardownState(T(6).e).explain.opacity).toBe(0);               // ...and have handed over by the time the nodes are placed
  });

  it('PULL-BACK: the camera zooms out and the chain is what is left to read', () => {
    near(teardownState(T(7).e).cam.scale, 0.62);
    expect(teardownState(T(7).e).cam.y).toBeLessThan(0);
    near(teardownState(1).chain.opacity, 1);
    expect(teardownState(1).verdict.opacity).toBe(1);
    expect(teardownState(1).explain.opacity).toBe(0);
    expect(teardownState(1).slabs.opacity).toBe(0);
    expect(teardownState(1).grid.opacity).toBe(0);
  });

  it('local runs 0..1 inside each state', () => {
    for (let k = 0; k < STATE_COUNT; k++) {
      near(teardownState(k * W).local, 0);
      near(teardownState((k + 0.5) * W).local, 0.5);
    }
    near(teardownState(1).local, 1);
  });
});

describe('STILLNESS: the verdict stamp gets the whole frame to itself', () => {
  const others = Object.keys(TRACKS).filter((k) => k !== 'verdictOpacity' && k !== 'verdictReveal') as (keyof typeof TRACKS)[];

  it('the stamp is short and fast, inside DECIDE', () => {
    expect(STILL.end - STILL.stamp).toBeLessThan(0.1 * W);
    expect(STILL.stamp).toBeGreaterThan(4 * W);
    expect(STILL.end).toBeLessThan(5 * W);
  });

  it('while the verdict stamps, no other value moves at all', () => {
    for (let i = 0; i <= 50; i++) {
      const p = STILL.stamp + ((STILL.end - STILL.stamp) * i) / 50;
      for (const k of others) expect(sample(TRACKS[k], p), `${k} at ${p}`).toBe(sample(TRACKS[k], STILL.stamp));
    }
  });

  it('and nothing moves in the stillness before it either: from the end of the funnel to the stamp', () => {
    for (let i = 0; i <= 50; i++) {
      const p = STILL.s + ((STILL.stamp - STILL.s) * i) / 50;
      for (const k of Object.keys(TRACKS) as (keyof typeof TRACKS)[]) expect(sample(TRACKS[k], p), `${k} at ${p}`).toBe(sample(TRACKS[k], STILL.s));
    }
  });
});

describe('teardownState: invariants', () => {
  const flat = (l: Layers) => [l.hash.settle, l.slabs.opacity, l.slabs.gap, l.slabs.x, l.slabs.labels, l.pull, l.stream.opacity, l.stream.bars, l.procs.grow, l.procs.opacity, l.grid.opacity, l.grid.assemble, l.grid.converge, l.model.opacity, l.verdict.opacity, l.verdict.reveal, l.verdict.dock, l.explain.open, l.explain.opacity, l.explain.bars, l.map.grow, l.chain.opacity];

  it('every value stays within 0..1 for any progress, including garbage', () => {
    for (const p of [-5, -0.001, 0, 0.123, 0.5, 0.999, 1, 1.5, NaN, Infinity, -Infinity])
      flat(teardownState(p)).forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); });
  });

  it('the camera stays between 0.62 and 1.1 and only lifts, never drops', () => {
    for (let i = 0; i <= 1000; i++) { const c = teardownState(i / 1000).cam; expect(c.scale).toBeGreaterThanOrEqual(0.62 - 1e-9); expect(c.scale).toBeLessThanOrEqual(1.1 + 1e-9); expect(c.y).toBeLessThanOrEqual(0); }
  });

  it('is continuous: no value jumps more than a sliver between neighbouring scroll positions', () => {
    let prev = flat(teardownState(0));
    for (let i = 1; i <= 8000; i++) {
      const cur = flat(teardownState(i / 8000));
      // the verdict stamp is the one deliberately fast edge on the page, so the bound is generous; the rest move far slower
      cur.forEach((v, j) => expect(Math.abs(v - prev[j]), `value ${j} at ${i / 8000}`).toBeLessThan(0.1));
      prev = cur;
    }
  });

  it('is reversible: the same progress always gives the same layers, so scrolling back reassembles', () => {
    const forward = [0.1, 0.4, 0.8, 0.95].map((p) => JSON.stringify(teardownState(p)));
    const back = [0.95, 0.8, 0.4, 0.1].map((p) => JSON.stringify(teardownState(p))).reverse();
    expect(back).toEqual(forward);
  });

  it('the slab gap never closes once opened going forward', () => {
    let gap = 0;
    for (let i = 0; i <= 800; i++) { const g = teardownState(i / 800).slabs.gap; expect(g).toBeGreaterThanOrEqual(gap); gap = g; }
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
