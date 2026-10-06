import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { allocate, assign, flightPos, pointPos, phase, scatter, MAX_POINTS, type Flight } from '../../src/engine/motion/stream';

const top12 = [10733, 6663, 5380, 5223, 5062, 5048, 4424, 4155, 4118, 4116, 4083, 3542];
const total = 94958;
const counts = [...top12, total - top12.reduce((a, b) => a + b, 0)]; // 12 APIs + everything else, all real

describe('allocate: points in proportion to real counts', () => {
  it('uses exactly 600 points, never more', () => {
    expect(MAX_POINTS).toBe(600);
    expect(allocate(counts).reduce((a, b) => a + b, 0)).toBe(600);
    expect(allocate(counts, 100).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("each API's share is its real share, within one point", () => {
    const shares = allocate(counts);
    const sum = counts.reduce((a, b) => a + b, 0);
    expect(sum).toBe(total);
    counts.forEach((c, i) => expect(Math.abs(shares[i] - (c / sum) * 600), `lane ${i}`).toBeLessThan(1));
  });

  it('a bigger count never gets fewer points than a smaller one', () => {
    const shares = allocate(counts);
    for (let i = 0; i < counts.length; i++) for (let j = 0; j < counts.length; j++) if (counts[i] > counts[j]) expect(shares[i]).toBeGreaterThanOrEqual(shares[j]);
  });

  it('handles the edges: nothing to allocate, one lane, zero counts, ties', () => {
    expect(allocate([])).toEqual([]);
    expect(allocate([0, 0])).toEqual([0, 0]);
    expect(allocate([5])).toEqual([600]);
    expect(allocate([1, 1, 1], 10).reduce((a, b) => a + b, 0)).toBe(10);
    expect(allocate([3, 0, 1], 8)).toEqual([6, 0, 2]);
    expect(allocate([1, 2], 0)).toEqual([0, 0]);
  });

  it('is deterministic', () => expect(allocate(counts)).toEqual(allocate(counts)));
});

describe('assign: lanes and cells', () => {
  it('gives every point a lane in order and a cell round-robin over the 54 cells', () => {
    const { lane, cell } = assign([3, 2, 1], 54);
    expect(lane).toEqual([0, 0, 0, 1, 1, 2]);
    expect(cell).toEqual([0, 1, 2, 3, 4, 5]);
    const big = assign(allocate(counts), 54);
    expect(big.lane).toHaveLength(600);
    expect(Math.max(...big.cell)).toBe(53);
    const per = new Array(54).fill(0);
    big.cell.forEach((c) => per[c]++);
    expect(Math.max(...per) - Math.min(...per)).toBeLessThanOrEqual(1); // the matrix fills evenly
  });
  it('copes with no cells', () => expect(assign([2], 0).cell).toEqual([0, 0]));
});

describe('point positions', () => {
  const fl: Flight = { x0: 400, x1: 700, gaps: [200, 320, 440], o: { x: 640, y: 400 }, zr: 160, lanes: 13 };

  it('phase and scatter are deterministic and in range', () => {
    for (let j = 0; j < 600; j++) { expect(phase(j)).toBeGreaterThanOrEqual(0); expect(phase(j)).toBeLessThan(1); expect(Math.abs(scatter(j))).toBeLessThanOrEqual(0.5); }
    expect(phase(7)).toBe(phase(7));
  });

  it('a point sits in the gap its index selects, never in a section it belongs to: gaps round-robin by index only', () => {
    // same index, different API lane: same gap (y at z = 0 is the gap itself)
    const atZero = (j: number, lane: number) => flightPos(j, lane, { ...fl, zr: 0 }, 0);
    for (let j = 0; j < 9; j++) { expect(atZero(j, 0).y).toBeCloseTo(atZero(j, 12).y, 9); expect(atZero(j, 0).y).toBeCloseTo(fl.gaps[j % 3], 9); }
  });

  it('a lane is a column across the stack width: lane 0 on the left, the last lane on the right', () => {
    const xs = [0, 6, 12].map((k) => flightPos(0, k, { ...fl, zr: 0 }, 0).x);
    expect(xs[0]).toBeLessThan(xs[1]); expect(xs[1]).toBeLessThan(xs[2]);
    expect(xs[0]).toBeGreaterThanOrEqual(400 - 20); expect(xs[2]).toBeLessThanOrEqual(700 + 20);
  });

  it('points fly along the camera axis: their scale runs from far (small) to near (large) as flow advances, and wraps', () => {
    const scales = [0, 0.25, 0.5, 0.75].map((f) => flightPos(5, 3, fl, f).s);
    expect(new Set(scales.map((s) => s.toFixed(4))).size).toBeGreaterThan(1);
    const lap = flightPos(5, 3, fl, 1), start = flightPos(5, 3, fl, 0);
    expect(lap.s).toBeCloseTo(start.s, 9); expect(lap.x).toBeCloseTo(start.x, 9);
    for (const f of [0, 0.3, 0.7, 1.9]) for (let j = 0; j < 50; j++) { const s = flightPos(j, j % 13, fl, f).s; expect(s).toBeGreaterThan(0.8); expect(s).toBeLessThan(1.2); }
  });

  it('near points spread away from the vanishing point, far points toward it', () => {
    const near = flightPos(0, 12, { ...fl, zr: 160 }, 0.5 - phase(0) + 0.499), far = flightPos(0, 12, { ...fl, zr: 160 }, 0.5 - phase(0) + 0.001);
    expect(near.s).toBeGreaterThan(far.s);
  });

  it('copes with one lane and no gaps list entries beyond the first', () => {
    expect(Number.isFinite(flightPos(3, 0, { ...fl, lanes: 1, gaps: [250] }, 0).x)).toBe(true);
  });

  it('vacuum then funnel: flight -> cell -> model, exact at the ends', () => {
    const from = [250, 100] as const, cell = [300, 400] as const, mid = [640, 250] as const;
    expect(pointPos(from, cell, mid, 0, 0)).toEqual([250, 100]);
    expect(pointPos(from, cell, mid, 1, 0)).toEqual([300, 400]);
    expect(pointPos(from, cell, mid, 1, 1)).toEqual([640, 250]);
    expect(pointPos(from, cell, mid, 0.5, 0)).toEqual([275, 250]);
  });
});

describe('the canvas is the scoped exception, and stays one', () => {
  const src = readFileSync('src/engine/motion/teardown.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // code only, not comments
  it('is 2D, never WebGL, and there is exactly one canvas', () => {
    expect(src).not.toMatch(/webgl|getContext\(['"](webgl|experimental)/i);
    expect(src.match(/getContext\(/g)).toHaveLength(1);
    expect(src).toContain("getContext('2d')");
    expect((src.match(/el\('canvas'/g) ?? []).length).toBe(1);
  });
  it('calls no requestAnimationFrame of its own', () => {
    expect(src).not.toMatch(/requestAnimationFrame/);
    expect(readFileSync('src/engine/motion/stream.ts', 'utf8')).not.toMatch(/requestAnimationFrame|document\./);
  });
});
