/**
 * Cinematic pacing for the MalTrace teardown: scroll DWELL. The nine states do not each get the same scroll; a few hero frames are
 * held. This file is the whole mapping, as one pure function: raw scroll progress (0..1 through the sticky stage) goes in, and the
 * progress the timeline is drawn at (teardown-state.ts) comes out.
 *
 *   move  the mapped progress advances from `from` to `to` over `len` viewports of scroll
 *   hold  `from === to`: the mapped progress is constant for `len` viewports, so the frame stays exactly as it is
 *
 * A hold is scroll distance, not time. It is not an animation and not a pause: if the visitor stops scrolling during one there is
 * nothing to run, and scrolling back through it is the same mapping in reverse. The stage's length is the sum of the segments (in
 * viewports, plus the one viewport the sticky stage fills), so the pacing is set here and nowhere else.
 *
 * One move is not continuous: after the VERDICT hold, progress goes from 6.2 to 7 states. Nothing moves anywhere in that range (the
 * stillness), so the picture does not change, and the label only advances when EXPLAIN actually starts. A test asserts it.
 */
import { W } from './teardown-state';

/** [from, to, viewports on desktop, viewports under 720px]. A hold has from === to. */
export type Seg = readonly [from: number, to: number, desktop: number, mobile: number];
/** The holds, in order (for tests and screenshots; not part of the running code). */
export const HOLD_NAMES = ['sealed', 'xray', 'explode', 'detonate', 'distill', 'verdict', 'explain', 'map'] as const;

export const SEGS: readonly Seg[] = [
  [0, 0.8 * W, 0.25, 0.25],                         // SEALED: the camera pushes in, the hash settles
  [0.8 * W, 0.8 * W, 0.15, 0.1],
  [0.8 * W, 1.98 * W, 0.55, 0.55],                  // X-RAY: the same object turns translucent, one scan sweeps it
  [1.98 * W, 1.98 * W, 0.55, 0.45],         // hero: the intact translucent file, framed to be read
  [1.98 * W, 2.96 * W, 0.7, 0.7],                   // EXPLODE: separate, then the rail, the leaders, the labels
  [2.96 * W, 2.96 * W, 1, 0.68],         // hero: the signature exploded frame
  [2.96 * W, 3.95 * W, 0.5, 0.5],                   // DETONATE: the stream arrives, the total resolves, the processes appear
  [3.95 * W, 3.95 * W, 0.9, 0.68],      // hero: the stream runs with the scroll through the held geometry
  [3.95 * W, 4.97 * W, 0.4, 0.4],                   // DISTILL: everything collapses into the 54 cells
  [4.97 * W, 4.97 * W, 0.2, 0.12],
  [4.97 * W, 5.8 * W, 0.35, 0.35],                  // DECIDE: the cells funnel into the model
  [5.8 * W, 6.2 * W, 0.15, 0.15],                   // VERDICT: the single fast stamp, at the start of the beat
  [6.2 * W, 6.2 * W, 1, 0.7],            // hero: absolute stillness
  [7 * W, 7.95 * W, 0.4, 0.4],                      // EXPLAIN: the node opens into the SHAP bars (jumps over the stillness)
  [7.95 * W, 7.95 * W, 0.2, 0.12],
  [7.95 * W, 8.5 * W, 0.4, 0.4],                    // MAP: the ATT&CK nodes grow out of the bars
  [8.5 * W, 8.5 * W, 0.6, 0.4],              // hero: reading dwell before the pull-back
  [8.5 * W, 1, 0.4, 0.4],                           // the final pull-back to the chain
];

const col = (mobile: boolean) => (mobile ? 3 : 2);
/** Scroll length of the story in viewports (the stage is this plus one tall). */
export const storyLength = (mobile: boolean) => SEGS.reduce((n, s) => n + s[col(mobile)], 0);

/** Raw scroll progress (0..1 through the sticky stage) to the progress the timeline is drawn at. */
export function storyProgress(raw: number, mobile: boolean): number {
  const c = col(mobile) as 2 | 3;
  let x = Math.min(1, Math.max(0, +raw || 0)) * storyLength(mobile); // NaN becomes 0, the infinities clamp
  for (const s of SEGS) {
    const t = Math.min(1, x / s[c]);
    // a boundary belongs to the segment that ends there, and the end of a move is its `to` exactly (no float dust at a hold's edge)
    if (x <= s[c] + 1e-9) return t > 1 - 1e-9 ? s[1] : s[0] + (s[1] - s[0]) * t;
    x -= s[c];
  }
  return 1;
}

export interface Story { p: number; hold: string | null; local: number }
/** The same mapping with the hold it is in (or null) and how far through its segment it is (0..1). For tests. */
export function storyInfo(raw: number, mobile: boolean): Story {
  const c = col(mobile) as 2 | 3, p = storyProgress(raw, mobile);
  let x = Math.min(1, Math.max(0, Number.isFinite(raw) ? raw : 0)) * storyLength(mobile), h = 0;
  for (const s of SEGS) {
    const hold = s[0] === s[1];
    if (x <= s[c] + 1e-9) return { p, hold: hold ? HOLD_NAMES[h] : null, local: Math.min(1, x / s[c]) };
    x -= s[c];
    if (hold) h++;
  }
  return { p, hold: null, local: 1 };
}

/** The raw range [start, end] of a named hold. For tests and screenshots. */
export function holdRange(name: string, mobile: boolean): [number, number] {
  const c = col(mobile), total = storyLength(mobile);
  let x = 0, h = 0;
  for (const s of SEGS) { if (s[0] === s[1]) { if (HOLD_NAMES[h++] === name) return [x / total, (x + s[c]) / total]; } x += s[c]; }
  throw new Error(`no hold named ${name}`);
}

/** The raw progress at which the move that reaches mapped progress `p` gets there. For tests. */
export function rawForP(p: number, mobile: boolean): number {
  const c = col(mobile), total = storyLength(mobile);
  let x = 0;
  for (const s of SEGS) {
    if (s[0] !== s[1] && p >= s[0] - 1e-12 && p <= s[1] + 1e-12) return (x + (s[c] * (p - s[0])) / (s[1] - s[0])) / total;
    x += s[c];
  }
  return 1;
}
