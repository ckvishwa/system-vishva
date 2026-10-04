/**
 * Pure scroll-story maths. Which pipeline nodes are on for a given beat progress.
 * No DOM, so the ordering and reversibility guarantees are unit-tested.
 */

/** "1-3" (1-based, inclusive, as printed on the diagram) -> zero-based [start, end]. */
export function parseRange(spec: string, total: number): [number, number] {
  const m = /^(\d+)-(\d+)$/.exec(spec.trim());
  if (!m) throw new Error(`story: bad node range "${spec}"`);
  const a = Number(m[1]) - 1, b = Number(m[2]) - 1;
  if (a < 0 || b < a || b >= total) throw new Error(`story: node range "${spec}" is outside 1-${total}`);
  return [a, b];
}

/** Share of the beat after which the last node is on; leaves the final stretch of the beat for reading. */
const SPREAD = 0.8;

/** Progress (0..1, strictly greater) at which node j of n switches on. Increasing in j, so nodes light in order. */
export const threshold = (j: number, n: number) => (j / n) * SPREAD;

/** Number of nodes on at progress p. p = 0 means the beat has not been reached: nothing is on. */
export function activeCount(p: number, n: number): number {
  let c = 0;
  for (let j = 0; j < n; j++) if (p > threshold(j, n)) c = j + 1;
  return c;
}

/**
 * Per-node on/off for the whole pipeline, given each group's progress.
 * Nodes after the last group (the tail) are lit by the last group's own progress, so every node
 * is reachable and the final scroll position shows the complete pipeline.
 */
export function pipelineState(total: number, groups: Array<{ range: [number, number]; progress: number }>): boolean[] {
  const on = new Array<boolean>(total).fill(false);
  groups.forEach((g, i) => {
    const start = g.range[0];
    const end = i === groups.length - 1 ? total - 1 : g.range[1];
    const n = end - start + 1;
    const c = activeCount(g.progress, n);
    for (let k = 0; k < c; k++) on[start + k] = true;
  });
  return on;
}

/** A connector draws once the node it leads into is on. */
export const traceOn = (on: boolean[], j: number) => !!on[j + 1];

/** A beat starts when its top reaches 75% of the viewport height and ends when its bottom reaches 45%. */
export const BEAT_START = 0.75;
export const BEAT_END = 0.45;

/**
 * Progress (0..1) through a beat, from its bounding box. Pure, so the scroll story needs no animation
 * library: scroll position in, progress out, and the same input always gives the same answer in both directions.
 */
export function sectionProgress(top: number, height: number, vh: number): number {
  const span = (BEAT_START - BEAT_END) * vh + height;
  return Math.max(0, Math.min(1, (BEAT_START * vh - top) / span));
}
