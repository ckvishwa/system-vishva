/**
 * The API stream (ADR-0016 amendment): the one scoped exception to "DOM only". A single 2D canvas (not WebGL) draws at most
 * 600 points that carry meaning: each API's share of the points is proportional to its real call count, so the density of the
 * stream is the volume of the calls. The points fly along the camera axis, through the gaps of the exploded stack; a point's
 * horizontal column is its API, its gap is just its index, so no API is tied to any PE section. In DISTILL the points are
 * vacuumed into the 54-cell matrix, then funnelled into the model.
 * Positions are a pure function of progress (nothing is timed), drawn on the shared scheduler, which sleeps when the scroll
 * stops. These are the pure parts; teardown.ts owns the canvas.
 */
import { project } from './explode';

export const MAX_POINTS = 600;

/** Split `n` points across lanes in proportion to `counts` (largest remainder), so the shares sum to exactly n. */
export function allocate(counts: number[], n = MAX_POINTS): number[] {
  const sum = counts.reduce((a, b) => a + b, 0);
  if (!sum || n <= 0) return counts.map(() => 0);
  const exact = counts.map((c) => (c / sum) * n);
  const out = exact.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left-- > 0) out[i]++; });
  return out;
}

const frac = (x: number) => x - Math.floor(x);
/** Where along its lane point j starts (0..1), spread evenly and deterministically (golden ratio). */
export const phase = (j: number) => frac(j * 0.6180339887);
/** Vertical scatter of point j within its lane, -0.5..0.5. */
export const scatter = (j: number) => frac(j * 0.7548776662) - 0.5;

export type Pt = readonly [x: number, y: number];
export interface Flight { x0: number; x1: number; gaps: number[]; o: { x: number; y: number }; zr: number; lanes: number }

/**
 * Point j of API lane k. Its column across the stack's width is its lane, its gap is j round-robin, and its depth runs from far
 * to near (`flow` laps over the whole scroll), so it travels along the camera axis. Returns the screen point and its scale.
 */
export function flightPos(j: number, lane: number, f: Flight, flow: number): { x: number; y: number; s: number } {
  const z = (frac(phase(j) + flow) * 2 - 1) * f.zr;
  const col = f.lanes > 1 ? lane / (f.lanes - 1) : 0.5;
  return project({ x: f.x0 + (col + scatter(j) * 0.05) * (f.x1 - f.x0), y: f.gaps[j % f.gaps.length], z }, f.o);
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Stream -> matrix cell (vac 0..1) -> model node (conv 0..1). */
export const pointPos = (from: Pt, cell: Pt, mid: Pt, vac: number, conv: number): Pt => [mix(mix(from[0], cell[0], vac), mid[0], conv), mix(mix(from[1], cell[1], vac), mid[1], conv)];

/** Which lane and which cell each of the points belongs to, from the lane shares. */
export function assign(shares: number[], cells: number): { lane: number[]; cell: number[] } {
  const lane: number[] = [];
  shares.forEach((s, k) => { for (let i = 0; i < s; i++) lane.push(k); });
  return { lane, cell: lane.map((_, j) => (cells ? j % cells : 0)) };
}
