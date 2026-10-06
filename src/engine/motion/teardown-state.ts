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
import type { MotionIntent } from './tokens';
import { sample, type EaseName, type Key } from './keyframes';

export const STATE_COUNT = 9;
export interface StateInfo { name: string; meaning: MotionIntent }
export const STATES: readonly StateInfo[] = [
  { name: 'SEALED', meaning: 'state' },
  { name: 'X-RAY', meaning: 'hierarchy' },
  { name: 'EXPLODE', meaning: 'hierarchy' },
  { name: 'DETONATE', meaning: 'flow' },
  { name: 'DISTILL', meaning: 'cause' },
  { name: 'DECIDE', meaning: 'dependency' },
  { name: 'VERDICT', meaning: 'change' },
  { name: 'EXPLAIN', meaning: 'cause' },
  { name: 'MAP', meaning: 'dependency' },
];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * A state's own motion happens during that state: window T(k) is its span, widened by half the overlap at each end, so
 * neighbouring windows overlap by 15% of a state (the next thing starts before the last has finished, nothing waits). Nothing
 * is shown ahead of its state: EXPLODE does not start lifting until the scroll is in EXPLODE. Tracks are ease-in-out cubic
 * unless a key says otherwise. The exception is VERDICT, which has no overlap: see STILL.
 */
export const W = 1 / STATE_COUNT;
export const OVERLAP = 0.15 * W;
export const T = (k: number) => ({ s: Math.max(0, k * W - OVERLAP / 2), e: Math.min(1, (k + 1) * W + OVERLAP / 2) });
const [T1, T2, T3, T4, T5, , T7, T8] = [1, 2, 3, 4, 5, 6, 7, 8].map(T);

/**
 * VERDICT is absolute stillness: from its start to its end the funnel is done, the camera has stopped and nothing changes
 * except the verdict, which stamps once and fast. The funnel ends at FUNNEL_END, before VERDICT begins; EXPLAIN starts after it.
 */
export const FUNNEL_END = 5.8 * W;
export const STILL = { s: 6 * W, stamp: 6.2 * W, end: 6.3 * W, e: 7 * W } as const;
/** The final portion of MAP: the nodes are placed, then the camera pulls back and the chain appears. */
export const PULL_BACK = 8.5 * W;

// Track shorthand: R ramps 0 -> 1 between two progresses; F fades in, holds, then fades out.
const R = (a: number, b: number, e?: EaseName): Key[] => [[a, 0], [b, 1, e]];
const F = (a: number, b: number, c: number, d: number): Key[] => [[a, 0], [b, 1], [c, 1], [d, 0]];
const SOLID = F(T1.s, T1.e, T4.e - 0.2 * W, T4.e); // the slabs and the alignment rail: from X-RAY until DISTILL has flattened them

export const TRACKS = {
  hashSettle: R(0, 0.6 * W, 'out'),
  // the camera: push in on the sealed file, ease back for the explosion, push in on the model, then pull back to the chain
  camScale: [[0, 0.8], [0.8 * W, 1, 'out'], [T2.s, 1], [T2.e, 0.92], [T4.s, 0.92], [T4.e, 1], [FUNNEL_END, 1.1], [STILL.e, 1.1], [T7.e, 1], [PULL_BACK, 1], [1, 0.62]] as Key[],
  camY: [[PULL_BACK, 0], [1, -0.14]] as Key[],
  // SEALED is opaque; X-RAY makes the same object semi-transparent; EXPLODE leaves a faint envelope that DISTILL removes
  shellFill: [[T1.s, 1], [T1.e, 0.15], [T2.e, 0]] as Key[],
  shellEdge: [[T1.s, 1], [T2.e, 0.35], [T4.s, 0.35], [T4.e, 0]] as Key[],
  slabsOpacity: SOLID,
  rail: SOLID,
  // X-RAY: sections sit inside the shell. EXPLODE: they lift out (gap), tilt and open in depth (explode); DISTILL rotates them back to one plane
  slabsGap: R(T2.s, T2.e),
  slabsExplode: F(T2.s, T2.e, T4.s, T4.e),
  slabsLabels: F(T2.e - 0.4 * W, T2.e, T4.s, T4.s + 0.4 * W),
  pull: R(T4.s, T4.e),
  // DETONATE: the API total resolves while the stream flies through the gaps and the process nodes appear
  streamOpacity: F(T3.s, T3.s + 0.3 * W, T4.s, T4.s + 0.5 * W),
  streamTotal: R(T3.s, T3.e),
  pointsOpacity: F(T3.s + 0.1 * W, T3.s + 0.4 * W, 5.6 * W, FUNNEL_END), // the 600-point canvas stream follows the matrix and the funnel, and is gone before the stillness
  procsGrow: R(T3.s + 0.3 * W, T3.e),
  procsOpacity: F(T3.s + 0.3 * W, T3.s + 0.4 * W, T4.e - 0.2 * W, T4.e),
  // DISTILL assembles the 54 cells; DECIDE funnels them into the model node
  gridAssemble: R(T4.s, T4.e),
  gridOpacity: F(T4.s, T4.s + 0.25 * W, 5.7 * W, FUNNEL_END),
  gridConverge: R(T5.s, FUNNEL_END),
  modelOpacity: F(T5.s, T5.s + 0.3 * W, STILL.e, 7.5 * W),
  verdictOpacity: R(STILL.stamp, STILL.end, 'out'),
  verdictReveal: R(STILL.stamp, STILL.end, 'out'),
  verdictDock: R(STILL.e, T7.e),
  // EXPLAIN: the node opens back out into SHAP bars; in MAP they hand over to the ATT&CK nodes that grow out of their ends
  explainOpen: R(STILL.e, T7.e),
  explainBars: R(7.1 * W, T7.e),
  explainOpacity: F(STILL.e, 7.2 * W, T8.s, PULL_BACK),
  mapGrow: R(T8.s, PULL_BACK),
  chainOpacity: R(PULL_BACK + 0.1 * W, 1),
} satisfies Record<string, Key[]>;

export interface Layers {
  /** 0..8, the state the scroll is in */
  index: number;
  /** 0..1 within that state */
  local: number;
  hash: { settle: number };
  cam: { scale: number; y: number };
  shell: { fill: number; edge: number };
  rail: number;
  slabs: { opacity: number; gap: number; explode: number; labels: number };
  pull: number;
  stream: { opacity: number; total: number };
  points: { opacity: number };
  procs: { grow: number; opacity: number };
  grid: { opacity: number; assemble: number; converge: number };
  model: { opacity: number };
  verdict: { opacity: number; reveal: number; dock: number };
  explain: { open: number; opacity: number; bars: number };
  map: { grow: number };
  chain: { opacity: number };
}

/**
 * Every track becomes a field of the result, nested by its name: slabsGap -> slabs.gap, camScale -> cam.scale, a bare name
 * (pull, rail) stays top level. One loop instead of a hand-written object, so adding a track is one line.
 */
export function teardownState(progress: number): Layers {
  const p = Number.isFinite(progress) ? clamp01(progress) : 0;
  const at = p * STATE_COUNT + 1e-9; // 7/9 * 9 is 6.999...: nudge so a boundary belongs to the state it starts
  const index = Math.min(STATE_COUNT - 1, Math.floor(at));
  const out: Record<string, any> = { index, local: clamp01(at - index) };
  for (const k of Object.keys(TRACKS) as (keyof typeof TRACKS)[]) {
    const m = k.match(/^([a-z]+)([A-Z].*)$/), v = sample(TRACKS[k], p);
    if (m) (out[m[1]] ??= {})[m[2].toLowerCase()] = v; else out[k] = v;
  }
  return out as Layers;
}

/** Scroll progress through a sticky stage: 0 when its top reaches the viewport top, 1 when its bottom reaches the viewport bottom. */
export function stageProgress(top: number, height: number, viewport: number): number {
  const span = height - viewport;
  return span > 0 ? clamp01(-top / span) + 0 : 0; // + 0 turns -0 into 0
}

/**
 * Slab heights for the PE sections: proportional to section size, with a floor so a 28 KB section stays a visible 1px
 * ruled box next to a 3.4 MB resource section. The real sizes are printed on every label; the floor is only drawing.
 * Heights sum to `total` (the stack's height).
 */
export function slabHeights(sizes: number[], total: number, floor: number): number[] {
  const sum = sizes.reduce((a, b) => a + b, 0);
  if (!sum || !sizes.length) return sizes.map(() => 0);
  const raw = sizes.map((s) => (s / sum) * total);
  const small = raw.filter((h) => h < floor).length;
  const rest = raw.reduce((a, h) => (h < floor ? a : a + h), 0);
  const room = total - small * floor;
  return raw.map((h) => (h < floor ? floor : (h / rest) * room));
}

/** Entropy above 7.0 is labelled HIGH ENTROPY. It is a measurement note, never a claim that the file is packed. */
export const HIGH_ENTROPY = 7.0;
export const entropyNote = (entropy: number): string | null => (entropy > HIGH_ENTROPY ? 'HIGH ENTROPY' : null);

/** Bar lengths 0..1 against the largest magnitude, for API counts and SHAP contributions. */
export function barLengths(values: number[]): number[] {
  const max = Math.max(0, ...values.map(Math.abs));
  return values.map((v) => (max ? Math.abs(v) / max : 0));
}
