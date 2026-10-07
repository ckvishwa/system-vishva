/**
 * MalTrace teardown (ADR-0016): one object, the sample, shown as a CAD exploded view and then taken through the whole
 * investigation as the page scrolls, with the camera following. This file is the whole timeline as pure functions of progress
 * (0..1 through the sticky stage). Nothing here touches the DOM or the clock, so every state boundary, overlap and the stillness
 * are unit-tested. engine/motion/teardown.ts applies these numbers to persistent elements; engine/motion/explode.ts is the
 * geometry (slab transforms, projection, annotation anchors).
 *
 * Nine states over one scroll. Every value is a keyframe track over progress, so scrolling back reassembles exactly
 * what scrolling forward took apart.
 */
import type { EaseName, Key } from './keyframes';
import { STATE_COUNT, W, layersFrom, type Layers } from './teardown-core';
export * from './teardown-core';

/**
 * A state's own motion happens during that state: window T(k) starts exactly at the state and runs 15% of a state past its end,
 * so neighbouring windows overlap by 15% (the next thing starts before the last has finished, nothing waits). Nothing is shown
 * ahead of its state: EXPLODE does not start lifting, and DETONATE's stream and counter do not begin, until the scroll is in
 * that state, so a held frame (story-map.ts) contains none of what comes next. Tracks are ease-in-out cubic unless a key says
 * otherwise. The exception is VERDICT, which has no overlap: see STILL.
 */
export const OVERLAP = 0.15 * W;
export const T = (k: number) => ({ s: k * W, e: Math.min(1, (k + 1) * W + OVERLAP) });
const [T1, T2, T3, T4, T5, , , T8] = [1, 2, 3, 4, 5, 6, 7, 8].map(T);

/**
 * VERDICT is absolute stillness: from its start to its end the funnel is done, the camera has stopped and nothing changes
 * except the verdict, which stamps once and fast, at the start of the beat. The funnel ends at FUNNEL_END, before VERDICT begins;
 * EXPLAIN starts after it.
 */
export const FUNNEL_END = 5.8 * W;
export const STILL = { s: 6 * W, stamp: 6.1 * W, end: 6.2 * W, e: 7 * W } as const;
/** The final portion of MAP: the nodes are placed, then the camera pulls back and the chain appears. */
export const PULL_BACK = 8.5 * W;
/**
 * The sub-beats of the hero states. Each one finishes before the progress at which story-map.ts holds the frame, so a held frame
 * is a finished one: EXPLODE separates, then the rail draws, then the leaders extend, then the labels resolve.
 */
const XRAYED = 1.95 * W, SEPARATED = 2.5 * W, RAIL_DONE = 2.62 * W, LEADERS_DONE = 2.78 * W, LABELS_DONE = 2.94 * W;
const DETONATED = 3.85 * W, DISTILLED = 4.95 * W, EXPLAINED = 7.9 * W;

// Track shorthand: R ramps 0 -> 1 between two progresses; F fades in, holds, then fades out.
const R = (a: number, b: number, e?: EaseName): Key[] => [[a, 0], [b, 1, e]];
const F = (a: number, b: number, c: number, d: number): Key[] => [[a, 0], [b, 1], [c, 1], [d, 0]];

export const TRACKS = {
  hashSettle: R(0, 0.6 * W, 'out'),
  // the camera: push in on the sealed file, ease back for the explosion, push in on the model, then pull back to the chain
  camScale: [[0, 0.8], [0.8 * W, 1, 'out'], [T2.s, 1], [SEPARATED, 0.92], [T4.s, 0.92], [DISTILLED, 1], [FUNNEL_END, 1.1], [STILL.e, 1.1], [EXPLAINED, 1], [PULL_BACK, 1], [1, 0.62]] as Key[],
  camY: [[PULL_BACK, 0], [1, -0.14]] as Key[],
  // SEALED is opaque; X-RAY makes the same object semi-transparent (one scan sweeps it, tied to scroll); EXPLODE leaves a faint envelope
  shellFill: [[T1.s, 1], [XRAYED, 0.15], [SEPARATED, 0]] as Key[],
  shellEdge: [[T1.s, 1], [SEPARATED, 0.35], [T4.s, 0.35], [DISTILLED, 0]] as Key[],
  scan: R(1.15 * W, 1.85 * W, 'linear'),
  slabsOpacity: F(T1.s, XRAYED, 4.75 * W, DISTILLED),
  // X-RAY: sections sit inside the shell. EXPLODE: they lift out (gap), tilt and open in depth, then the rail draws, the leader
  // lines extend and the labels resolve. DISTILL rotates the sections back to one plane.
  slabsGap: R(T2.s, SEPARATED),
  slabsExplode: F(T2.s, SEPARATED, T4.s, DISTILLED),
  rail: R(SEPARATED, RAIL_DONE),
  leader: R(RAIL_DONE, LEADERS_DONE),
  slabsLabels: F(LEADERS_DONE, LABELS_DONE, T4.s, T4.s + 0.4 * W),
  pull: R(T4.s, DISTILLED),
  // DETONATE: the API total resolves while the stream flies through the gaps and the process nodes appear
  streamOpacity: F(T3.s, T3.s + 0.3 * W, T4.s, T4.s + 0.5 * W),
  streamTotal: R(T3.s, DETONATED),
  pointsOpacity: F(T3.s + 0.1 * W, T3.s + 0.4 * W, 5.6 * W, FUNNEL_END), // the 600-point canvas stream follows the matrix and the funnel, and is gone before the stillness
  procsGrow: R(T3.s + 0.3 * W, DETONATED),
  procsOpacity: F(T3.s + 0.3 * W, T3.s + 0.4 * W, 4.75 * W, DISTILLED),
  // DISTILL assembles the 54 cells; DECIDE funnels them into the model node
  gridAssemble: R(T4.s, DISTILLED),
  gridOpacity: F(T4.s, T4.s + 0.25 * W, 5.7 * W, FUNNEL_END),
  gridConverge: R(T5.s, FUNNEL_END),
  modelOpacity: F(T5.s, T5.s + 0.3 * W, STILL.e, 7.5 * W),
  verdictOpacity: R(STILL.stamp, STILL.end, 'out'),
  verdictReveal: R(STILL.stamp, STILL.end, 'out'),
  verdictDock: R(STILL.e, EXPLAINED),
  // EXPLAIN: the node opens back out into SHAP bars; in MAP they hand over to the ATT&CK nodes that grow out of their ends
  explainOpen: R(STILL.e, EXPLAINED),
  explainBars: R(7.1 * W, EXPLAINED),
  explainOpacity: F(STILL.e, 7.2 * W, T8.s, PULL_BACK),
  mapGrow: R(T8.s, PULL_BACK),
  chainOpacity: R(PULL_BACK + 0.1 * W, 1),
} satisfies Record<string, Key[]>;

export const teardownState = (progress: number): Layers => layersFrom(progress, TRACKS);
