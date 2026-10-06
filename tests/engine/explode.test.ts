import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { slabTransform, project, slabPoint, bands, labelSpot, SPREAD, MAX_ROT, PERSP } from '../../src/engine/motion/explode';

const D = SPREAD.desktop, M = SPREAD.mobile;

describe('slabTransform: derived from the index, never from a name', () => {
  it('even slabs go left and forward, odd slabs right and back', () => {
    for (const i of [0, 2, 4]) { const t = slabTransform(i, 6, 1, D); expect(t.x, `slab ${i}`).toBeLessThan(0); expect(t.z).toBeGreaterThan(0); }
    for (const i of [1, 3, 5]) { const t = slabTransform(i, 6, 1, D); expect(t.x, `slab ${i}`).toBeGreaterThan(0); expect(t.z).toBeLessThan(0); }
  });

  it('is the identity at t = 0, and grows with t', () => {
    for (let i = 0; i < 5; i++) Object.values(slabTransform(i, 5, 0, D)).forEach((v) => expect(Math.abs(v)).toBe(0));
    for (let i = 0; i < 4; i++) { const a = slabTransform(i, 4, 0.5, D), b = slabTransform(i, 4, 1, D); expect(Math.abs(b.x)).toBeGreaterThan(Math.abs(a.x)); expect(Math.abs(b.z)).toBeGreaterThan(Math.abs(a.z)); }
  });

  it('never tilts more than 12 degrees, on desktop or mobile, for any count of slabs', () => {
    expect(MAX_ROT).toBe(12);
    for (const s of [D, M, { x: 1, z: 1, rot: 90 }]) for (const n of [1, 2, 4, 7, 20]) for (let i = 0; i < n; i++) for (const t of [0, 0.3, 1]) {
      const r = slabTransform(i, n, t, s);
      expect(Math.abs(r.rx)).toBeLessThanOrEqual(12); expect(Math.abs(r.ry)).toBeLessThanOrEqual(12);
    }
  });

  it('mobile is shallower than desktop: less sideways, less depth, less tilt', () => {
    for (let i = 0; i < 4; i++) {
      const d = slabTransform(i, 4, 1, D), m = slabTransform(i, 4, 1, M);
      expect(Math.abs(m.x)).toBeLessThan(Math.abs(d.x)); expect(Math.abs(m.z)).toBeLessThan(Math.abs(d.z));
      expect(Math.abs(m.ry)).toBeLessThan(Math.abs(d.ry)); expect(Math.abs(m.rx)).toBeLessThan(Math.abs(d.rx));
    }
  });

  it('deeper slabs in the stack open a little further', () => {
    expect(Math.abs(slabTransform(2, 5, 1, D).x)).toBeGreaterThan(Math.abs(slabTransform(0, 5, 1, D).x));
    expect(Math.abs(slabTransform(3, 5, 1, D).z)).toBeGreaterThan(Math.abs(slabTransform(1, 5, 1, D).z));
  });

  it('a single slab does not divide by zero', () => expect(Number.isFinite(slabTransform(0, 1, 1, D).x)).toBe(true));

  it('takes no section name: the teardown code never keys a transform on .text, .rdata, .data or .rsrc', () => {
    for (const f of ['src/engine/motion/explode.ts', 'src/engine/motion/teardown.ts']) expect(readFileSync(f, 'utf8'), f).not.toMatch(/['"`]\.(text|rdata|data|rsrc)['"`]/);
    expect(slabTransform.length).toBe(4); // (index, count, t, spread): no name
  });
});

describe('project: perspective about the origin', () => {
  const o = { x: 640, y: 400 };
  it('leaves the origin and z = 0 untouched', () => {
    expect(project({ x: 700, y: 450, z: 0 }, o)).toMatchObject({ x: 700, y: 450, s: 1 });
    expect(project({ x: 640, y: 400, z: 300 }, o)).toMatchObject({ x: 640, y: 400 });
  });
  it('brings points toward the viewer away from the origin, and pushes far points in', () => {
    const near = project({ x: 740, y: 400, z: 300 }, o), far = project({ x: 740, y: 400, z: -300 }, o);
    expect(near.x).toBeGreaterThan(740); expect(far.x).toBeLessThan(740);
    expect(near.s).toBeCloseTo(PERSP / (PERSP - 300), 9);
    expect(far.s).toBeCloseTo(PERSP / (PERSP + 300), 9);
  });
  it('scales distances from the origin by exactly s', () => {
    const p = project({ x: 840, y: 600, z: 200 }, o);
    expect(p.x - o.x).toBeCloseTo(200 * p.s, 9);
    expect(p.y - o.y).toBeCloseTo(200 * p.s, 9);
  });
});

describe('slabPoint: where an annotation anchor lands on screen', () => {
  const o = { x: 640, y: 400 }, c = { x: 600, y: 300 };
  const flat = { x: 0, z: 0, rx: 0, ry: 0 };

  it('with no transform it is just the slab edge', () => {
    const p = slabPoint({ x: -150, y: 0 }, c, flat, o);
    expect(p.x).toBeCloseTo(450, 9); expect(p.y).toBeCloseTo(300, 9);
  });
  it('a sideways offset moves the anchor by that offset at z = 0', () => {
    expect(slabPoint({ x: 150, y: 0 }, c, { ...flat, x: 64 }, o).x).toBeCloseTo(600 + 150 + 64, 9);
  });
  it('rotateY swings the edge in depth: the near edge grows, the far edge shrinks (both measured about the origin)', () => {
    const right = slabPoint({ x: 150, y: 0 }, c, { ...flat, ry: 10 }, o), left = slabPoint({ x: -150, y: 0 }, c, { ...flat, ry: 10 }, o);
    expect(right.s).toBeLessThan(1);   // rotateY(+) sends the right edge away
    expect(left.s).toBeGreaterThan(1); // and brings the left edge toward the viewer
    expect(right.x).toBeLessThan(600 + 150);
  });
  it('rotateX tips the top and bottom in depth', () => {
    const up = slabPoint({ x: 0, y: -60 }, c, { ...flat, rx: 10 }, o), down = slabPoint({ x: 0, y: 60 }, c, { ...flat, rx: 10 }, o);
    expect(up.s).not.toBeCloseTo(down.s, 3);
  });
  it('z translation brings the anchor toward the viewer: it lands further from the origin', () => {
    const a = slabPoint({ x: 150, y: 0 }, c, flat, o), b = slabPoint({ x: 150, y: 0 }, c, { ...flat, z: 150 }, o);
    expect(Math.abs(b.x - o.x)).toBeGreaterThan(Math.abs(a.x - o.x));
  });
  it('matches the browser: it agrees with a hand-computed CSS transform for a known case', () => {
    // translate3d(10px, 0, 100px) rotateY(10deg) on a point 100px right of the centre, origin 100px left of it
    const rad = Math.PI / 180, local = 100, ry = 10;
    const x = 500 + 10 + local * Math.cos(ry * rad), z = 100 + -local * Math.sin(ry * rad);
    const want = project({ x, y: 300, z }, { x: 400, y: 300 });
    const got = slabPoint({ x: local, y: 0 }, { x: 500, y: 300 }, { x: 10, z: 100, rx: 0, ry }, { x: 400, y: 300 });
    expect(got.x).toBeCloseTo(want.x, 9); expect(got.y).toBeCloseTo(want.y, 9);
  });
  it('a dy offset moves it vertically', () => expect(slabPoint({ x: 0, y: 0 }, c, flat, o, 25).y).toBeCloseTo(325, 9));
});

describe('bands: where the sections sit inside the shell in X-RAY', () => {
  const sizes = [{ size: 28672 }, { size: 24576 }, { size: 8192 }, { size: 3448832 }];

  it('without raw offsets the bands are equal and are NOT proportional: nothing is derived from the sizes', () => {
    const r = bands(sizes, 3514368, 400);
    expect(r.proportional).toBe(false);
    expect(r.bands.map((b) => b.h)).toEqual([100, 100, 100, 100]);
    expect(r.bands.map((b) => b.y)).toEqual([0, 100, 200, 300]);
    // cumulative sizes would put .rdata at 28672/3514368 of the height; the equal layout must not
    expect(r.bands[1].y).not.toBeCloseTo((28672 / 3514368) * 400, 1);
  });

  it('with real raw offsets for every section the bands sit at offset / file size', () => {
    const withOff = [{ size: 28672, offset: 1024 }, { size: 24576, offset: 29696 }, { size: 8192, offset: 54272 }, { size: 3448832, offset: 62464 }];
    const r = bands(withOff, 3514368, 400);
    expect(r.proportional).toBe(true);
    r.bands.forEach((b, i) => { expect(b.y).toBeCloseTo((withOff[i].offset / 3514368) * 400, 9); expect(b.h).toBeGreaterThanOrEqual(2); });
    expect(r.bands[3].h).toBeCloseTo((3448832 / 3514368) * 400, 9);
  });

  it('one missing offset is enough to fall back to equal bands (no partial guessing)', () => {
    const partial = [{ size: 1, offset: 100 }, { size: 1 }, { size: 1, offset: 300 }];
    expect(bands(partial, 1000, 90).proportional).toBe(false);
  });

  it('needs the file size too, and copes with no sections', () => {
    expect(bands([{ size: 1, offset: 0 }], 0, 90).proportional).toBe(false);
    expect(bands([], 1000, 90)).toEqual({ bands: [], proportional: false });
  });

  it('equal bands tile the shell exactly', () => {
    const r = bands(sizes, 1, 360).bands;
    expect(r[r.length - 1].y + r[r.length - 1].h).toBeCloseTo(360, 9);
  });
});

describe('labelSpot: annotations stay inside the viewport', () => {
  const W = 390, pad = 16, bw = 250, bh = 60;

  it('desktop: even labels on the left margin, odd on the right, level with the anchor', () => {
    const l = labelSpot(0, { x: 400, y: 300 }, 0, 1280, 24, false, 210, 60), r = labelSpot(1, { x: 800, y: 300 }, 0, 1280, 24, false, 210, 60);
    expect(l).toMatchObject({ x: 24, right: false }); expect(r).toMatchObject({ x: 1280 - 24 - 210, right: true });
    expect(l.y).toBe(270); expect(r.y).toBe(270);
    expect(l).toMatchObject({ lx: 24 + 210, ly: 300 }); expect(r).toMatchObject({ lx: 1280 - 24 - 210, ly: 300 }); // leaders leave the inner edge, level with the anchor
  });

  it('mobile: alternating sides, directly below the slab', () => {
    const a = labelSpot(0, { x: 200, y: 100 }, 140, W, pad, true, bw, bh), b = labelSpot(1, { x: 200, y: 100 }, 140, W, pad, true, bw, bh);
    expect(a.right).toBe(false); expect(b.right).toBe(true);
    expect(a.y).toBe(144); expect(b.y).toBe(144);
  });

  it('never leaves [pad, W - pad], for any slab, any width', () => {
    for (const mobile of [true, false]) for (const w of [320, 390, 768, 1280]) for (let i = 0; i < 8; i++) {
      const s = labelSpot(i, { x: w / 2, y: 200 }, 220, w, 16, mobile, Math.min(250, w * 0.62), 60);
      expect(s.x, `${w} #${i}`).toBeGreaterThanOrEqual(16);
      expect(s.x + Math.min(250, w * 0.62), `${w} #${i}`).toBeLessThanOrEqual(w - 16);
    }
  });
});
