import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { allocate, assign, lanePos, pointPos, phase, scatter, MAX_POINTS, type Lane } from '../../src/engine/motion/stream';

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
  const lane: Lane = { y: 100, x0: 200, x1: 600, h: 20 };

  it('phase and scatter are deterministic and in range', () => {
    for (let j = 0; j < 600; j++) { expect(phase(j)).toBeGreaterThanOrEqual(0); expect(phase(j)).toBeLessThan(1); expect(Math.abs(scatter(j))).toBeLessThanOrEqual(0.5); }
    expect(phase(7)).toBe(phase(7));
  });

  it('points stay inside their lane box at every flow value', () => {
    for (const flow of [0, 0.3, 1, 2.7, 5.99, 6]) for (let j = 0; j < 600; j++) {
      const [x, y] = lanePos(j, lane, flow);
      expect(x).toBeGreaterThanOrEqual(lane.x0); expect(x).toBeLessThanOrEqual(lane.x1);
      expect(y).toBeGreaterThanOrEqual(lane.y - lane.h / 2); expect(y).toBeLessThanOrEqual(lane.y + lane.h / 2);
    }
  });

  it('flow moves points along the lane, and a full lap returns them', () => {
    const a = lanePos(5, lane, 0), b = lanePos(5, lane, 0.1), c = lanePos(5, lane, 1);
    expect(b[0]).not.toBe(a[0]);
    expect(c[0]).toBeCloseTo(a[0], 6);
    expect(c[1]).toBe(a[1]);
  });

  it('vacuum then funnel: lane -> cell -> model, exact at the ends', () => {
    const from = [250, 100] as const, cell = [300, 400] as const, mid = [640, 250] as const;
    expect(pointPos(from, cell, mid, 0, 0)).toEqual([250, 100]);
    expect(pointPos(from, cell, mid, 1, 0)).toEqual([300, 400]);
    expect(pointPos(from, cell, mid, 1, 1)).toEqual([640, 250]);
    const half = pointPos(from, cell, mid, 0.5, 0);
    expect(half).toEqual([275, 250]);
  });
});

describe('the canvas is the scoped exception, and stays one', () => {
  const src = readFileSync('src/engine/motion/teardown.ts', 'utf8');
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
