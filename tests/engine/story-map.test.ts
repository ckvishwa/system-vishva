import { describe, it, expect } from 'vitest';
import { SEGS, HOLD_NAMES, storyProgress as plain, storyInfo as storyProgress, storyLength, holdRange, rawForP } from '../../src/engine/motion/story-map';
import { teardownState, STATE_COUNT, W, STILL, type Layers } from '../../src/engine/motion/teardown-state';

const near = (a: number, b: number, d = 9) => expect(a).toBeCloseTo(b, d);
const HOLDS = ['sealed', 'xray', 'explode', 'detonate', 'distill', 'verdict', 'explain', 'map'];
const range = (name: string, m: boolean, n = 120) => { const [a, b] = holdRange(name, m); return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n); };
const vp = (name: string, m: boolean) => { const [a, b] = holdRange(name, m); return (b - a) * storyLength(m); };
// the 15% overlaps leave tiny tails on the ease curves; a held frame is finished to within a percent
const zero = (v: number) => expect(Math.abs(v)).toBeLessThan(0.01);
const one = (v: number) => expect(v).toBeGreaterThan(0.99);
const strip = (l: Layers) => ({ ...l, index: 0, local: 0 });
const json = (r: number, m: boolean) => JSON.stringify(teardownState(storyProgress(r, m).p));

describe('the story length: pacing set in one place', () => {
  it('desktop: the stage is 950-1000vh (the story plus the viewport it fills)', () => {
    const vh = (storyLength(false) + 1) * 100;
    expect(vh).toBeGreaterThanOrEqual(950); expect(vh).toBeLessThanOrEqual(1000);
  });
  it('mobile: a shorter profile, 80-85% of the desktop scroll, nowhere near 1000vh', () => {
    const ratio = storyLength(true) / storyLength(false);
    expect(ratio).toBeGreaterThanOrEqual(0.8); expect(ratio).toBeLessThanOrEqual(0.86);
    expect((storyLength(true) + 1) * 100).toBeLessThan(900);
  });
  it('the segment lengths are the only thing the two profiles differ in: the same mapped progress anchors', () => {
    for (const s of SEGS) { expect(s[2]).toBeGreaterThan(0); expect(s[3]).toBeGreaterThan(0); expect(s[3]).toBeLessThanOrEqual(s[2]); }
  });
});

describe('hero dwell lengths (viewports of scroll)', () => {
  it('desktop: X-RAY 0.5-0.6, EXPLODE about 1, DETONATE 0.8-1, VERDICT about 1, MAP 0.5-0.7', () => {
    expect(vp('xray', false)).toBeGreaterThanOrEqual(0.5); expect(vp('xray', false)).toBeLessThanOrEqual(0.6);
    near(vp('explode', false), 1, 6);
    expect(vp('detonate', false)).toBeGreaterThanOrEqual(0.8); expect(vp('detonate', false)).toBeLessThanOrEqual(1);
    near(vp('verdict', false), 1, 6);
    expect(vp('map', false)).toBeGreaterThanOrEqual(0.5); expect(vp('map', false)).toBeLessThanOrEqual(0.7);
  });
  it('mobile uses the shorter dwell map: X-RAY 0.4-0.5, EXPLODE 0.6-0.75, DETONATE 0.6-0.75, VERDICT about 0.7, MAP about 0.4', () => {
    expect(vp('xray', true)).toBeGreaterThanOrEqual(0.4); expect(vp('xray', true)).toBeLessThanOrEqual(0.5);
    expect(vp('explode', true)).toBeGreaterThanOrEqual(0.6); expect(vp('explode', true)).toBeLessThanOrEqual(0.75);
    expect(vp('detonate', true)).toBeGreaterThanOrEqual(0.6); expect(vp('detonate', true)).toBeLessThanOrEqual(0.75);
    near(vp('verdict', true), 0.7, 6);
    near(vp('map', true), 0.4, 6);
  });
  it('the secondary beats (SEALED, DISTILL, EXPLAIN) get much shorter reading plateaus on both profiles', () => {
    for (const m of [false, true]) for (const n of ['sealed', 'distill', 'explain']) { expect(vp(n, m), `${n} ${m}`).toBeLessThanOrEqual(0.2); expect(vp(n, m)).toBeLessThan(vp('xray', m) / 2); }
  });
  it('there is no dwell for DECIDE: only the named beats hold', () => {
    const named = SEGS.filter((s) => s[0] === s[1]);
    expect(named).toHaveLength(HOLD_NAMES.length);
    expect([...HOLD_NAMES]).toEqual(HOLDS);
  });
});

describe('storyProgress: every segment boundary, forward', () => {
  for (const mobile of [false, true]) {
    it(`${mobile ? 'mobile' : 'desktop'}: starts at 0, ends at 1, never decreases, and is continuous except across the stillness`, () => {
      expect(storyProgress(0, mobile).p).toBe(0);
      expect(storyProgress(1, mobile).p).toBe(1);
      let prev = 0, jumps = 0;
      for (let i = 1; i <= 8000; i++) {
        const p = storyProgress(i / 8000, mobile).p;
        expect(p).toBeGreaterThanOrEqual(prev);
        if (p - prev > 0.02) { jumps++; near(prev, 6.2 * W, 3); near(p, 7 * W, 2); } // the only jump: over the stillness, from VERDICT's hold to EXPLAIN
        prev = p;
      }
      expect(jumps).toBe(1);
    });

    it(`${mobile ? 'mobile' : 'desktop'}: at each boundary the mapped progress is the segment's own anchor`, () => {
      const c = mobile ? 3 : 2, total = storyLength(mobile);
      let x = 0;
      for (const s of SEGS) {
        near(storyProgress(x / total + 1e-9, mobile).p, s[0], 6);               // just inside the segment: at its start
        near(storyProgress((x + s[c]) / total, mobile).p, s[1], 9);              // its end: its `to`
        x += s[c];
      }
      near(x, total);
    });
  }
});

describe('holds: the mapped progress is numerically constant across the whole input range', () => {
  for (const mobile of [false, true]) for (const name of HOLDS) {
    it(`${name} (${mobile ? 'mobile' : 'desktop'}): p is exactly constant, and so is the entire visual state`, () => {
      const rs = range(name, mobile);
      const first = storyProgress(rs[0], mobile), first_json = json(rs[0], mobile);
      for (const r of rs) {
        const s = storyProgress(r, mobile);
        expect(s.p, `${name} @${r}`).toBe(first.p);
        if (r !== rs[0]) expect(s.hold).toBe(name);   // the very first point is the end of the move that arrives at the frame
        expect(json(r, mobile)).toBe(first_json);
      }
      expect(storyProgress(rs[1], mobile).local).toBeLessThan(0.05); expect(storyProgress(rs[rs.length - 1], mobile).local).toBeCloseTo(1, 9);
    });
  }

  it('a hold lies inside its own state, so its label reads right', () => {
    const idx: Record<string, number> = { sealed: 0, xray: 1, explode: 2, detonate: 3, distill: 4, verdict: 6, explain: 7, map: 8 };
    for (const n of HOLDS) expect(teardownState(storyProgress(holdRange(n, false)[0], false).p).index, n).toBe(idx[n]);
  });

  it('outside a hold, progress moves and hold is null', () => {
    const [a] = holdRange('explode', false);
    expect(storyProgress(a - 0.01, false).hold).toBeNull();
    expect(storyProgress(a - 0.02, false).p).toBeLessThan(storyProgress(a - 0.01, false).p);
  });
});

describe('each held frame is a finished frame', () => {
  const at = (n: string, m = false) => teardownState(storyProgress(holdRange(n, m)[0] + 1e-9, m).p);

  it('SEALED: the file is opaque, the camera is in, the hash is settled', () => {
    const l = at('sealed');
    expect(l.shell.fill).toBe(1); expect(l.cam.scale).toBe(1); near(l.hash.settle, 1);
    expect(l.slabs.opacity).toBe(0);
  });

  it('X-RAY: the intact translucent file, sections inside it, nothing separated, the scan finished', () => {
    const l = at('xray');
    expect(l.shell.fill).toBeLessThan(0.2); expect(l.shell.edge).toBeGreaterThan(0.3);
    one(l.slabs.opacity); zero(l.slabs.gap); zero(l.slabs.explode);
    expect(l.scan).toBe(1); expect(l.rail).toBe(0);
  });

  it('EXPLODE: fully separated, the rail drawn, every leader extended, every label resolved', () => {
    const l = at('explode');
    near(l.slabs.gap, 1); near(l.slabs.explode, 1); near(l.rail, 1); near(l.leader, 1); near(l.slabs.labels, 1);
    one(l.slabs.opacity); zero(l.pull);
    near(l.cam.scale, 0.92);
    zero(l.stream.opacity);
  });

  it('EXPLODE: the four beats happen in order: separate, rail, leaders, labels', () => {
    const p = (n: number) => teardownState(n * W);
    near(p(2.5).slabs.gap, 1); expect(p(2.5).rail).toBe(0);
    near(p(2.62).rail, 1); expect(p(2.62).leader).toBe(0);
    near(p(2.78).leader, 1); expect(p(2.78).slabs.labels).toBe(0);
    near(p(2.94).slabs.labels, 1);
    expect(p(2.3).rail).toBe(0); expect(p(2.7).leader).toBeGreaterThan(0); expect(p(2.7).leader).toBeLessThan(1);
  });

  it('DETONATE: the exploded geometry stays, the total has resolved, the processes have grown, the stream is on', () => {
    const l = at('detonate');
    one(l.slabs.gap); one(l.slabs.explode); one(l.rail); one(l.leader);
    one(l.stream.total); one(l.procs.grow); one(l.procs.opacity); one(l.stream.opacity); one(l.points.opacity);
    zero(l.pull);
  });

  it('DISTILL: the 54 cells are assembled and everything else has collapsed', () => {
    const l = at('distill');
    near(l.grid.assemble, 1); near(l.pull, 1); zero(l.slabs.opacity); zero(l.procs.opacity); zero(l.grid.converge);
  });

  it('VERDICT: stamped, and everything else already still', () => {
    const l = at('verdict');
    near(l.verdict.opacity, 1); near(l.verdict.reveal, 1); expect(l.verdict.dock).toBe(0);
    expect(l.explain.open).toBe(0); near(l.model.opacity, 1); near(l.cam.scale, 1.1);
  });

  it('EXPLAIN: the bars are out and the verdict is docked', () => {
    const l = at('explain');
    near(l.explain.bars, 1); near(l.explain.open, 1); near(l.verdict.dock, 1); zero(l.map.grow);
  });

  it('MAP: every ATT&CK node is out, the camera has not pulled back yet', () => {
    const l = at('map');
    near(l.map.grow, 1); near(l.cam.scale, 1); expect(l.chain.opacity).toBe(0); zero(l.explain.opacity);
  });

  it('the mobile profile holds the same frames', () => {
    for (const n of HOLDS) expect(JSON.stringify(at(n, true))).toBe(JSON.stringify(at(n, false)));
  });
});

describe('a held frame holds nothing from the NEXT state (the WebKit ghost: a faint "21 API calls" at the EXPLODE dwell)', () => {
  // Layers that belong to later states must be EXACTLY zero while an earlier state is held, not merely invisible: a 15% overlap
  // used to start DETONATE's stream and counter inside the EXPLODE hold, leaving them at 0.6% opacity.
  const at = (n: string) => teardownState(storyProgress(holdRange(n, false)[0] + 1e-9, false).p);
  const later = (l: Layers, keys: string[]) => keys.map((k) => [k, k.split('.').reduce((o: any, p) => o[p], l)] as const);
  const STREAM = ['stream.opacity', 'stream.total', 'points.opacity', 'procs.grow', 'procs.opacity'];
  const DISTILL = ['pull', 'grid.opacity', 'grid.assemble', 'grid.converge', 'model.opacity'];
  const END = ['verdict.opacity', 'verdict.dock', 'explain.open', 'explain.opacity', 'explain.bars', 'map.grow', 'chain.opacity'];
  const EXPLODE = ['slabs.gap', 'slabs.explode', 'slabs.labels', 'rail', 'leader'];

  it('SEALED, X-RAY and EXPLODE hold none of what follows', () => {
    for (const [n, keys] of [['sealed', [...EXPLODE, ...STREAM, ...DISTILL, ...END, 'scan']], ['xray', [...EXPLODE, ...STREAM, ...DISTILL, ...END]], ['explode', [...STREAM, ...DISTILL, ...END]]] as const)
      for (const [k, v] of later(at(n), [...keys])) expect(v, `${n}: ${k}`).toBe(0);
  });
  it('DETONATE and DISTILL hold none of what follows', () => {
    for (const [n, keys] of [['detonate', [...DISTILL, ...END]], ['distill', ['grid.converge', 'model.opacity', ...END]]] as const)
      for (const [k, v] of later(at(n), [...keys])) expect(v, `${n}: ${k}`).toBe(0);
  });
  it('VERDICT, EXPLAIN and MAP hold none of what follows', () => {
    for (const [n, keys] of [['verdict', ['verdict.dock', 'explain.open', 'explain.opacity', 'explain.bars', 'map.grow', 'chain.opacity']], ['explain', ['map.grow', 'chain.opacity']], ['map', ['chain.opacity']]] as const)
      for (const [k, v] of later(at(n), [...keys])) expect(v, `${n}: ${k}`).toBe(0);
  });
  it('and a layer that is absent in a held frame is exactly zero everywhere in the hold, so nothing can show through', () => {
    for (const mobile of [false, true]) {
      const [a, b] = holdRange('explode', mobile);
      for (let i = 0; i <= 50; i++) for (const [k, v] of later(teardownState(storyProgress(a + ((b - a) * i) / 50, mobile).p), STREAM)) expect(v, k).toBe(0);
    }
  });
});

describe('EXPLODE geometry is identical at the start, middle and end of its dwell', () => {
  it('every layer, and the hold-local position goes 0 -> 1', () => {
    for (const mobile of [false, true]) {
      const [a, b] = holdRange('explode', mobile);
      const [s, m, e] = [a + 1e-12, (a + b) / 2, b - 1e-12].map((r) => storyProgress(r, mobile));
      expect(m.p).toBe(s.p); expect(e.p).toBe(s.p);
      expect(JSON.stringify(teardownState(m.p))).toBe(JSON.stringify(teardownState(s.p)));
      expect(s.local).toBeGreaterThan(0.99 - 1); near(m.local, 0.5, 3); expect(e.local).toBeGreaterThan(0.99);
    }
  });
});

describe('VERDICT: absolute stillness through the whole dwell, after one stamp at its start', () => {
  it('the stamp has already happened when the dwell begins', () => {
    const [a] = holdRange('verdict', false);
    near(teardownState(storyProgress(a, false).p).verdict.opacity, 1);
    expect(teardownState(storyProgress(a - 0.05, false).p).verdict.opacity).toBeLessThan(1); // and it was not there a little before
  });
  it('the stamp itself is short: a small part of a viewport, at the end of its move', () => {
    const idx = SEGS.findIndex((s, i) => s[0] === s[1] && s[0] === 6.2 * W) - 1, c = 2;
    const move = SEGS[idx][c];
    const stampShare = (STILL.end - STILL.stamp) / (6.2 * W - 5.8 * W);
    expect(move * stampShare).toBeLessThan(0.06);
  });
  it('nothing differs between any two points of the dwell, in any layer, on either profile', () => {
    for (const mobile of [false, true]) {
      const rs = range('verdict', mobile, 300);
      const ref = json(rs[0], mobile);
      for (const r of rs) expect(json(r, mobile)).toBe(ref);
    }
  });
});

describe('across the stillness: the jump changes nothing you can see', () => {
  it('every layer at the end of VERDICT equals every layer at the start of EXPLAIN, apart from the label', () => {
    for (const mobile of [false, true]) {
      const [, end] = holdRange('verdict', mobile);
      const before = teardownState(storyProgress(end, mobile).p), after = teardownState(7 * W);
      expect(strip(after)).toEqual(strip(before));
      expect(after.index).toBe(before.index + 1); // the label advances only when EXPLAIN really starts
    }
  });
});

describe('reverse scrolling: leaving a hold backwards is smooth, and it is the same mapping', () => {
  const flat = (l: Layers) => JSON.stringify(strip(l)).match(/-?\d+\.?\d*(e-?\d+)?/g)!.map(Number);
  it('stepping back out of any hold changes every layer by a sliver per step, never a jump (but the stillness jump, in reverse)', () => {
    for (const mobile of [false, true]) for (const n of HOLDS) {
      const [a] = holdRange(n, mobile);
      let prev = flat(teardownState(storyProgress(a, mobile).p));
      for (let i = 1; i <= 200; i++) {
        const r = a - i * 0.0004;
        if (r < 0) break;
        const cur = flat(teardownState(storyProgress(r, mobile).p));
        cur.forEach((v, j) => expect(Math.abs(v - prev[j]), `${n} step ${i} value ${j}`).toBeLessThan(0.3)); // the verdict's stamp is the one fast edge
        prev = cur;
      }
    }
  });

  it('leaving a hold forwards and then reversing retraces exactly: out and back gives the same state', () => {
    for (const mobile of [false, true]) {
      const rs = Array.from({ length: 1001 }, (_, i) => i / 1000);
      const fwd = rs.map((r) => json(r, mobile));
      const back = [...rs].reverse().map((r) => json(r, mobile)).reverse();
      expect(back).toEqual(fwd);
      expect(fwd[0]).toBe(json(0, mobile));
    }
  });

  it('reverse scroll reassembles the file: raw 0 is the sealed object again, whatever came before', () => {
    const l = teardownState(storyProgress(0, false).p);
    expect(l.shell).toEqual({ fill: 1, edge: 1 });
    expect(l.slabs.opacity).toBe(0); expect(l.slabs.gap).toBe(0); expect(l.cam.scale).toBe(0.8);
  });

  it('the move before a hold approaches its frame monotonically, so the exit is a straight reversal of the entry', () => {
    for (const n of ['xray', 'explode', 'detonate', 'map']) {
      const [a] = holdRange(n, false);
      let prev = storyProgress(a, false).p;
      for (let i = 1; i <= 100; i++) { const p = storyProgress(a - i * 0.001, false).p; expect(p).toBeLessThanOrEqual(prev); prev = p; }
    }
  });
});

describe('helpers', () => {
  it('rawForP finds where a move reaches a mapped progress, and holdRange the span of a hold', () => {
    for (const mobile of [false, true]) {
      near(storyProgress(rawForP(2.5 * W, mobile), mobile).p, 2.5 * W, 6);
      near(storyProgress(rawForP(5 * W, mobile), mobile).p, 5 * W, 6);
      near(storyProgress(rawForP(1, mobile), mobile).p, 1, 6);
      const [a, b] = holdRange('detonate', mobile);
      expect(b).toBeGreaterThan(a); expect(a).toBeGreaterThan(rawForP(2.96 * W, mobile));
    }
    expect(() => holdRange('nope', false)).toThrow();
  });
  it('the number-only mapping the stage runs equals the full one', () => {
    for (const m of [false, true]) for (let i = 0; i <= 500; i++) expect(plain(i / 500, m)).toBe(storyProgress(i / 500, m).p);
  });
  it('garbage input is clamped', () => {
    for (const r of [-1, NaN, 2, Infinity, -Infinity]) { const s = storyProgress(r, false); expect(s.p).toBeGreaterThanOrEqual(0); expect(s.p).toBeLessThanOrEqual(1); }
    expect(STATE_COUNT).toBe(9);
  });
});
