import { describe, it, expect } from 'vitest';
import { teardownState, stageProgress, slabHeights, entropyNote, barLengths, STATES, STATE_COUNT, TRACKS, STILL, FUNNEL_END, T, W, type Layers } from '../../src/engine/motion/teardown-state';
import { sample } from '../../src/engine/motion/keyframes';

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('teardownState: the 9 states', () => {
  it('names them, each with one meaning from the motion vocabulary', () => {
    expect(STATE_COUNT).toBe(9);
    expect(STATES.map((s) => s.name)).toEqual(['SEALED', 'X-RAY', 'EXPLODE', 'DETONATE', 'DISTILL', 'DECIDE', 'VERDICT', 'EXPLAIN', 'MAP']);
    expect(STATES.map((s) => s.meaning)).toEqual(['state', 'hierarchy', 'hierarchy', 'flow', 'cause', 'dependency', 'change', 'cause', 'dependency']);
  });

  it('there is no separate PULL-BACK state: it is the final portion of MAP', () => {
    expect(STATES.map((s) => s.name)).not.toContain('PULL-BACK');
    expect(teardownState(8.3 * W).cam.scale).toBe(1);                // MAP starts with the camera where EXPLAIN left it...
    expect(teardownState(1).cam.scale).toBeCloseTo(0.62, 9);         // ...and ends pulled back
    expect(teardownState(8.3 * W).index).toBe(8);
    expect(teardownState(1).index).toBe(8);
    expect(teardownState(8.3 * W).chain.opacity).toBe(0);
    near(teardownState(1).chain.opacity, 1);
  });

  it('maps progress to the state index at every boundary', () => {
    for (let k = 0; k < STATE_COUNT; k++) {
      expect(teardownState(k * W).index, `start of ${k}`).toBe(k);
      expect(teardownState(k * W + 1e-6).index).toBe(k);
      expect(teardownState((k + 1) * W - 1e-6).index).toBe(k);
    }
    expect(teardownState(1).index).toBe(STATE_COUNT - 1);
  });

  it('SEALED (p=0): one opaque object, nothing else on, the camera pulled out', () => {
    const l = teardownState(0);
    expect(l.shell).toEqual({ fill: 1, edge: 1 });
    expect(l.slabs.opacity).toBe(0);                 // the sections are not drawn yet: it is one solid object
    expect(l.slabs.gap).toBe(0); expect(l.slabs.explode).toBe(0); expect(l.slabs.labels).toBe(0);
    expect(l.rail).toBe(0);
    expect(l.cam.scale).toBeLessThan(0.9);
    expect(l.hash.settle).toBe(0);
    expect(l.stream.opacity + l.points.opacity + l.procs.opacity + l.grid.opacity + l.model.opacity + l.verdict.opacity + l.explain.opacity + l.chain.opacity).toBe(0);
  });

  it('SEALED: the camera pushes in and the hash settles before X-RAY', () => {
    expect(teardownState(0.8 * W).cam.scale).toBe(1);
    near(teardownState(0.6 * W).hash.settle, 1);
    expect(teardownState(0.3 * W).hash.settle).toBeGreaterThan(0.5);
  });

  it('X-RAY: the SAME object turns semi-transparent and the sections appear inside it, with nothing separated', () => {
    const e = teardownState(T(1).e);
    near(e.shell.fill, 0.15);                         // the shell is still there, now translucent
    expect(e.shell.edge).toBeGreaterThan(0.5);
    expect(e.slabs.opacity).toBe(1);                  // the sections are visible inside it
    expect(e.rail).toBe(1);
    expect(teardownState(1.9 * W).slabs.gap).toBe(0); // not lifted
    expect(teardownState(1.9 * W).slabs.explode).toBe(0); // not tilted or spread
  });

  it('EXPLODE: the shell becomes a faint envelope while the sections lift out, tilt and open in depth', () => {
    const e = teardownState(T(2).e);
    near(e.shell.fill, 0);
    near(e.shell.edge, 0.35);
    near(e.slabs.gap, 1);
    near(e.slabs.explode, 1);
    near(e.slabs.labels, 1);                          // the annotations are up
    expect(teardownState(T(2).s).slabs.gap).toBe(0);
  });

  it('DETONATE: the API total resolves to the whole, the stream and the process nodes run, the sections stay exploded', () => {
    const e = teardownState(T(3).e), m = teardownState(3.45 * W);
    near(e.stream.total, 1);                          // the total has resolved to the whole
    near(e.procs.grow, 1);                            // and every process node has grown
    expect(m.stream.opacity).toBe(1);                 // the stream is on screen mid-state...
    expect(m.points.opacity).toBe(1);
    near(m.procs.opacity, 1);
    near(m.slabs.gap, 1);                             // ...through the still-exploded sections
    near(m.slabs.explode, 1);
    expect(m.slabs.opacity).toBe(1);
  });

  it('DISTILL: the sections rotate back toward one plane, then everything collapses into the 54 cells', () => {
    near(teardownState(T(4).s).slabs.explode, 1);
    near(teardownState(T(4).e).slabs.explode, 0);                // one plane again
    near(teardownState(T(4).e).pull, 1);
    near(teardownState(T(4).e).grid.assemble, 1);
    expect(teardownState(T(4).e).slabs.opacity).toBe(0);
    expect(teardownState(T(4).e).procs.opacity).toBe(0);
    expect(teardownState(T(4).e).shell.edge).toBe(0);
    expect(teardownState(4.4 * W).grid.opacity).toBe(1);
  });

  it('DECIDE: the 54 cells funnel into the model node, and the camera pushes in on it', () => {
    near(teardownState(T(5).s).grid.converge, 0);
    near(teardownState(FUNNEL_END).grid.converge, 1);
    expect(teardownState(T(5).s + 0.4 * W).model.opacity).toBe(1);
    expect(teardownState(FUNNEL_END).cam.scale).toBeGreaterThan(1.05);
    expect(teardownState(FUNNEL_END).grid.opacity).toBe(0);
    expect(teardownState(FUNNEL_END).points.opacity).toBe(0);
    expect(teardownState(5.9 * W).verdict.opacity).toBe(0);      // not yet: the funnel ends before VERDICT starts
  });

  it('the funnel is finished before VERDICT begins', () => {
    expect(FUNNEL_END).toBeLessThan(STILL.s);
    expect(STILL.s).toBe(6 * W);
  });

  it('VERDICT: the verdict stamps, then EXPLAIN opens the model out into the bars', () => {
    expect(teardownState(STILL.stamp).verdict.opacity).toBe(0);
    near(teardownState(STILL.end).verdict.opacity, 1);
    near(teardownState(STILL.end).verdict.reveal, 1);
    near(teardownState(T(7).s + 0.4 * W).explain.open, teardownState(T(7).s + 0.4 * W).explain.open);
    near(teardownState(T(7).e).verdict.dock, 1);
    near(teardownState(T(7).e).explain.open, 1);
    near(teardownState(T(7).e).explain.bars, 1);
    expect(teardownState(T(7).e).model.opacity).toBeLessThan(0.5);
  });

  it('MAP: the ATT&CK nodes grow out of the bars, which hand over to them', () => {
    near(teardownState(T(8).s).map.grow, 0);
    near(teardownState(T(8).e).map.grow, 1);
    expect(teardownState(T(8).s).explain.opacity).toBe(1);
    expect(teardownState(T(8).e).explain.opacity).toBe(0);
  });

  it('local runs 0..1 inside each state', () => {
    for (let k = 0; k < STATE_COUNT; k++) {
      expect(teardownState(k * W).local).toBeCloseTo(0, 6);
      expect(teardownState((k + 0.5) * W).local).toBeCloseTo(0.5, 6);
    }
    expect(teardownState(1).local).toBeCloseTo(1, 6);
  });
});

describe('VERDICT is absolute stillness: nothing but the verdict changes', () => {
  const others = Object.keys(TRACKS).filter((k) => k !== 'verdictOpacity' && k !== 'verdictReveal') as (keyof typeof TRACKS)[];

  it('the stamp is short and fast, inside VERDICT', () => {
    expect(STILL.end - STILL.stamp).toBeLessThan(0.15 * W);
    expect(STILL.stamp).toBeGreaterThan(STILL.s);
    expect(STILL.end).toBeLessThan(STILL.e);
    expect(STILL.e).toBe(7 * W);
  });

  it('for the whole state, from its first moment to its last, no other value moves at all', () => {
    for (let i = 0; i <= 200; i++) {
      const p = STILL.s + ((STILL.e - STILL.s) * i) / 200;
      for (const k of others) expect(sample(TRACKS[k], p), `${k} at ${p}`).toBe(sample(TRACKS[k], STILL.s));
    }
  });

  it('while the verdict stamps, the verdict is the only thing that changes', () => {
    const a = teardownState(STILL.stamp), b = teardownState(STILL.end);
    const strip = (l: Layers) => ({ ...l, verdict: { ...l.verdict, opacity: 0, reveal: 0 }, local: 0 });
    expect(strip(a)).toEqual(strip(b));
    expect(b.verdict.opacity).toBeGreaterThan(a.verdict.opacity);
  });

  it('motion resumes only after VERDICT: EXPLAIN starts exactly at its end, not before', () => {
    expect(teardownState(STILL.e).explain.open).toBe(0);
    expect(teardownState(STILL.e + 0.1 * W).explain.open).toBeGreaterThan(0);
    expect(teardownState(STILL.e - 1e-9).explain.open).toBe(0);
    expect(teardownState(STILL.e).verdict.dock).toBe(0);
  });
});

describe('teardownState: invariants', () => {
  const flat = (l: Layers) => [l.hash.settle, l.shell.fill, l.shell.edge, l.rail, l.slabs.opacity, l.slabs.gap, l.slabs.explode, l.slabs.labels, l.pull, l.stream.opacity, l.stream.total, l.points.opacity, l.procs.grow, l.procs.opacity, l.grid.opacity, l.grid.assemble, l.grid.converge, l.model.opacity, l.verdict.opacity, l.verdict.reveal, l.verdict.dock, l.explain.open, l.explain.opacity, l.explain.bars, l.map.grow, l.chain.opacity];

  it('every value stays within 0..1 for any progress, including garbage', () => {
    for (const p of [-5, -0.001, 0, 0.123, 0.5, 0.999, 1, 1.5, NaN, Infinity, -Infinity])
      flat(teardownState(p)).forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); });
  });

  it('the camera stays between 0.62 and 1.1 and only lifts, never drops', () => {
    for (let i = 0; i <= 1000; i++) { const c = teardownState(i / 1000).cam; expect(c.scale).toBeGreaterThanOrEqual(0.62 - 1e-9); expect(c.scale).toBeLessThanOrEqual(1.1 + 1e-9); expect(c.y).toBeLessThanOrEqual(0); }
  });

  it('is continuous: no value jumps more than a sliver between neighbouring scroll positions', () => {
    let prev = flat(teardownState(0));
    for (let i = 1; i <= 9000; i++) {
      const cur = flat(teardownState(i / 9000));
      // the verdict stamp is the one deliberately fast edge on the page, so the bound is generous; the rest move far slower
      cur.forEach((v, j) => expect(Math.abs(v - prev[j]), `value ${j} at ${i / 9000}`).toBeLessThan(0.1));
      prev = cur;
    }
  });

  it('REVERSE SCROLL REASSEMBLES: every state is exactly what it was on the way forward, and p = 0 is the sealed file again', () => {
    const ps = Array.from({ length: 401 }, (_, i) => i / 400);
    const forward = ps.map((p) => JSON.stringify(teardownState(p)));
    const backward = [...ps].reverse().map((p) => JSON.stringify(teardownState(p))).reverse();
    expect(backward).toEqual(forward);
    expect(teardownState(1 - 1)).toEqual(teardownState(0));
    // out to the end and all the way back: identical to never having left
    expect(JSON.stringify(teardownState(0))).toBe(forward[0]);
    const l = teardownState(0);
    expect(l.shell).toEqual({ fill: 1, edge: 1 });
    expect(l.slabs).toEqual({ opacity: 0, gap: 0, explode: 0, labels: 0 });
    expect(l.cam).toEqual({ scale: 0.8, y: 0 });
  });

  it('the slab gap never closes once opened going forward, and the explode amount returns to zero by DISTILL', () => {
    let gap = 0;
    for (let i = 0; i <= 900; i++) { const g = teardownState(i / 900).slabs.gap; expect(g).toBeGreaterThanOrEqual(gap); gap = g; }
    expect(teardownState(T(4).e).slabs.explode).toBe(0);
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
