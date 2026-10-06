/**
 * MalTrace teardown (ADR-0016): one object, the sample, transformed from sealed file to finished investigation as the page
 * scrolls, with the camera following. This file is the whole timeline as pure functions of progress (0..1 through the sticky
 * stage). Nothing here touches the DOM or the clock, so every state boundary, overlap and the stillness are unit-tested.
 * engine/motion/teardown.ts applies these numbers to persistent elements as transform, opacity and clip-path.
 *
 * Eight states over one scroll. Every value is a keyframe track over progress, so scrolling back reassembles exactly
 * what scrolling forward took apart.
 */
import type { MotionIntent } from './tokens';
import { sample, type Key } from './keyframes';

export const STATE_COUNT = 8;
export interface StateInfo { name: string; meaning: MotionIntent }
export const STATES: readonly StateInfo[] = [
  { name: 'SEALED', meaning: 'state' },
  { name: 'CRACK', meaning: 'hierarchy' },
  { name: 'DETONATE', meaning: 'flow' },
  { name: 'DISTILL', meaning: 'cause' },
  { name: 'DECIDE', meaning: 'change' },
  { name: 'EXPLAIN', meaning: 'cause' },
  { name: 'MAP', meaning: 'dependency' },
  { name: 'PULL-BACK', meaning: 'flow' },
];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * State k's entrance is a window T(k) centred on the boundary k/8, one state plus 15% long, so neighbouring windows overlap
 * by 15% of a state: the next thing starts before the last has finished, nothing waits. Tracks are ease-in-out cubic unless
 * a key says otherwise. The last window ends a little before 1, leaving a short rest on the finished chain.
 */
export const W = 1 / STATE_COUNT;
export const OVERLAP = 0.15 * W;
export const T = (k: number) => ({ s: Math.max(0, k * W - W / 2 - OVERLAP / 2), e: Math.min(1, k * W + W / 2 + OVERLAP / 2) });
const [T1, T2, T3, T4, T5, T6, T7] = [1, 2, 3, 4, 5, 6, 7].map(T);

/**
 * STILLNESS (inside DECIDE): the matrix has funnelled into the model, the camera has stopped, nothing moves. Then the verdict
 * stamps once, fast. During the stamp no other track changes: the biggest hit on the page gets the whole frame to itself.
 */
export const STILL = { s: 4 * W, stamp: 4.25 * W, end: 4.3 * W } as const;

export const TRACKS = {
  hashSettle: [[0, 0], [0.6 * W, 1, 'out']],
  // the camera: push in on the sealed file, ease back for the explosion, push in on the model, then pull back to the chain
  camScale: [[0, 0.8], [0.8 * W, 1, 'out'], [T2.s, 1], [T3.s, 0.92], [T3.e, 1], [STILL.s, 1.1], [T5.s, 1.1], [T5.e, 1], [T7.s, 1], [T7.e, 0.62]],
  camY: [[T7.s, 0], [T7.e, -0.14]],
  // CRACK opens the block a quarter of the way, DETONATE pulls it fully apart and over to the left
  slabsGap: [[T1.s, 0], [T1.e, 0.25], [T2.e, 1]],
  slabsX: [[T2.s, 0], [T2.e, 1]],
  slabsLabels: [[T1.s, 0], [T1.e, 1], [T3.s, 1], [T3.s + 0.4 * W, 0]],
  slabsOpacity: [[T3.e - 0.2 * W, 1], [T3.e, 0]],
  // DISTILL pulls the stream, the processes and the slabs inward; the matrix assembles
  pull: [[T3.s, 0], [T3.e, 1]],
  streamOpacity: [[T2.s, 0], [T2.s + 0.3 * W, 1], [T3.s, 1], [T3.s + 0.5 * W, 0]],
  streamBars: [[T2.s, 0], [T2.e, 1]],
  procGrow: [[T2.s + 0.3 * W, 0], [T2.e, 1]],
  procOpacity: [[T2.s + 0.3 * W, 0], [T2.s + 0.4 * W, 1], [T3.e - 0.2 * W, 1], [T3.e, 0]],
  gridAssemble: [[T3.s, 0], [T3.e, 1]],
  gridOpacity: [[T3.s, 0], [T3.s + 0.25 * W, 1], [STILL.s - 0.2 * W, 1], [STILL.s, 0]],
  gridConverge: [[T4.s, 0], [STILL.s, 1]],
  modelOpacity: [[T4.s, 0], [T4.s + 0.3 * W, 1], [T5.s, 1], [T5.s + 0.5 * W, 0]],
  verdictOpacity: [[STILL.stamp, 0], [STILL.end, 1, 'out']],
  verdictReveal: [[STILL.stamp, 0], [STILL.end, 1, 'out']],
  verdictDock: [[T5.s, 0], [T5.e, 1]],
  // EXPLAIN: the node opens back out into SHAP bars; in MAP they hand over to the ATT&CK nodes that grow out of their ends
  explainOpen: [[T5.s, 0], [T5.e, 1]],
  explainBars: [[T5.s + 0.1 * W, 0], [T5.e, 1]],
  explainOpacity: [[T5.s, 0], [T5.s + 0.2 * W, 1], [T6.s, 1], [T6.e, 0]],
  mapGrow: [[T6.s, 0], [T6.e, 1]],
  chainOpacity: [[T7.s + 0.2 * W, 0], [T7.e, 1]],
} as const satisfies Record<string, readonly Key[]>;

export interface Layers {
  /** 0..7, the state the scroll is in */
  index: number;
  /** 0..1 within that state */
  local: number;
  hash: { settle: number };
  cam: { scale: number; y: number };
  slabs: { opacity: number; gap: number; x: number; labels: number };
  pull: number;
  stream: { opacity: number; bars: number };
  procs: { grow: number; opacity: number };
  grid: { opacity: number; assemble: number; converge: number };
  model: { opacity: number };
  verdict: { opacity: number; reveal: number; dock: number };
  explain: { open: number; opacity: number; bars: number };
  map: { grow: number };
  chain: { opacity: number };
}

export function teardownState(progress: number): Layers {
  const p = Number.isFinite(progress) ? clamp01(progress) : 0;
  const index = Math.min(STATE_COUNT - 1, Math.floor(p * STATE_COUNT));
  const v = (k: keyof typeof TRACKS) => sample(TRACKS[k], p);
  return {
    index,
    local: clamp01(p * STATE_COUNT - index),
    hash: { settle: v('hashSettle') },
    cam: { scale: v('camScale'), y: v('camY') },
    slabs: { opacity: v('slabsOpacity'), gap: v('slabsGap'), x: v('slabsX'), labels: v('slabsLabels') },
    pull: v('pull'),
    stream: { opacity: v('streamOpacity'), bars: v('streamBars') },
    procs: { grow: v('procGrow'), opacity: v('procOpacity') },
    grid: { opacity: v('gridOpacity'), assemble: v('gridAssemble'), converge: v('gridConverge') },
    model: { opacity: v('modelOpacity') },
    verdict: { opacity: v('verdictOpacity'), reveal: v('verdictReveal'), dock: v('verdictDock') },
    explain: { open: v('explainOpen'), opacity: v('explainOpacity'), bars: v('explainBars') },
    map: { grow: v('mapGrow') },
    chain: { opacity: v('chainOpacity') },
  };
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
