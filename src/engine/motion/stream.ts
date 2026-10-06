/**
 * The API stream (ADR-0016 amendment): the one scoped exception to "DOM only". A single 2D canvas (not WebGL) draws at most
 * 600 points that carry meaning: each API's share of the points is proportional to its real call count, so the density of the
 * stream is the volume of the calls. In DISTILL the points are vacuumed into the 54-cell matrix, then funnelled into the model.
 * Positions are a pure function of progress (nothing is timed), drawn on the shared scheduler, which sleeps when the scroll
 * stops. These are the pure parts; teardown.ts owns the canvas.
 */
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
export interface Lane { y: number; x0: number; x1: number; h: number }

/** Point j in its lane: it travels from x0 to x1 and wraps, `flow` laps in total over the whole scroll. */
export const lanePos = (j: number, lane: Lane, flow: number): Pt => [lane.x0 + frac(phase(j) + flow) * (lane.x1 - lane.x0), lane.y + scatter(j) * lane.h];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Stream -> matrix cell (vac 0..1) -> model node (conv 0..1). */
export const pointPos = (from: Pt, cell: Pt, mid: Pt, vac: number, conv: number): Pt => [mix(mix(from[0], cell[0], vac), mid[0], conv), mix(mix(from[1], cell[1], vac), mid[1], conv)];

/** Which lane and which cell each of the points belongs to, from the lane shares. */
export function assign(shares: number[], cells: number): { lane: number[]; cell: number[] } {
  const lane: number[] = [];
  shares.forEach((s, k) => { for (let i = 0; i < s; i++) lane.push(k); });
  return { lane, cell: lane.map((_, j) => (cells ? j % cells : 0)) };
}
