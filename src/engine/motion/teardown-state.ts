/**
 * MalTrace teardown (ADR-0016): the sample dismantled layer by layer as the page scrolls. This file is the whole timeline,
 * as pure functions of progress (0..1 through the sticky stage). Nothing here touches the DOM or the clock, so every state
 * boundary is unit-tested. engine/motion/teardown.ts applies these numbers to the stage as transform, opacity and clip-path.
 *
 * Seven states over one scroll. Every layer's value is a keyframe track over progress, so scrolling back reassembles exactly
 * what scrolling forward peeled off.
 */
import type { MotionIntent } from './tokens';
import { sample, type Key } from './keyframes';

export const STATE_COUNT = 7;
export interface StateInfo { name: string; meaning: MotionIntent }
export const STATES: readonly StateInfo[] = [
  { name: 'SEALED', meaning: 'state' },
  { name: 'CRACK', meaning: 'hierarchy' },
  { name: 'DETONATE', meaning: 'flow' },
  { name: 'DISTILL', meaning: 'cause' },
  { name: 'DECIDE', meaning: 'change' },
  { name: 'EXPLAIN', meaning: 'cause' },
  { name: 'MAP', meaning: 'dependency' },
];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * The timeline. State k's entrance is a window T(k) centred on the boundary k/7, one state plus 15% long, so neighbouring
 * windows overlap by 15% of a state: the next thing starts before the last has finished, nothing waits. Each layer's value
 * is a track of keyframes (keyframes.ts) over the one global progress, ease-in-out cubic unless noted. The last window ends
 * a little before 1, leaving a short rest on the finished map.
 */
export const W = 1 / STATE_COUNT;
export const OVERLAP = 0.15 * W;
export const T = (k: number) => ({ s: Math.max(0, k * W - W / 2 - OVERLAP / 2), e: Math.min(1, k * W + W / 2 + OVERLAP / 2) });
const [T1, T2, T3, T4, T5, T6] = [1, 2, 3, 4, 5, 6].map(T);

export const TRACKS = {
  hashSettle: [[0, 0], [0.5 * W, 1, 'out']],
  slabsOpacity: [[T3.s, 1], [3.25 * W, 0]],
  // CRACK opens the block a quarter of the way, DETONATE pulls it fully apart
  slabsGap: [[T1.s, 0], [T1.e, 0.25], [T2.e, 1]],
  slabsLabels: [[T1.s, 0], [T1.e, 1]],
  streamOpacity: [[T2.s, 0], [T2.s + 0.35 * W, 1], [T3.s, 1], [T3.s + 0.4 * W, 0]],
  streamBars: [[T2.s, 0], [T2.e, 1]],
  gridOpacity: [[T3.s, 0], [T3.s + 0.25 * W, 1], [T4.e - 0.25 * W, 1], [T4.e, 0]],
  gridAssemble: [[T3.s, 0], [T3.e, 1]],
  gridConverge: [[T4.s, 0], [T4.e, 1]],
  modelOpacity: [[T4.s, 0], [T4.s + 0.3 * W, 1], [T5.s, 1], [T5.s + 0.5 * W, 0]],
  verdictOpacity: [[T4.e - 0.35 * W, 0], [T4.e - 0.25 * W, 1]],
  verdictReveal: [[T4.e - 0.35 * W, 0], [T4.e, 1]],
  verdictDock: [[T5.s, 0], [T5.e, 1]],
  explainOpacity: [[T5.s, 0], [T5.s + 0.3 * W, 1], [T6.s, 1], [T6.s + 0.4 * W, 0]],
  explainBars: [[T5.s, 0], [T5.e, 1]],
  mapOpacity: [[T6.s, 0], [T6.s + 0.3 * W, 1]],
  mapLocked: [[T6.s, 0], [1, 1, 'linear']],
} as const satisfies Record<string, readonly Key[]>;

export interface Layers {
  /** 0..6, the state the scroll is in */
  index: number;
  /** 0..1 within that state */
  local: number;
  hash: { settle: number };
  slabs: { opacity: number; gap: number; labels: number };
  stream: { opacity: number; bars: number; total: number };
  grid: { opacity: number; assemble: number; converge: number };
  model: { opacity: number };
  verdict: { opacity: number; reveal: number; dock: number };
  explain: { opacity: number; bars: number };
  map: { opacity: number; locked: number };
}

export function teardownState(progress: number): Layers {
  const p = Number.isFinite(progress) ? clamp01(progress) : 0;
  const index = Math.min(STATE_COUNT - 1, Math.floor(p * STATE_COUNT));
  const v = (k: keyof typeof TRACKS) => sample(TRACKS[k], p);
  return {
    index,
    local: clamp01(p * STATE_COUNT - index),
    hash: { settle: v('hashSettle') },
    slabs: { opacity: v('slabsOpacity'), gap: v('slabsGap'), labels: v('slabsLabels') },
    stream: { opacity: v('streamOpacity'), bars: v('streamBars'), total: v('streamBars') },
    grid: { opacity: v('gridOpacity'), assemble: v('gridAssemble'), converge: v('gridConverge') },
    model: { opacity: v('modelOpacity') },
    verdict: { opacity: v('verdictOpacity'), reveal: v('verdictReveal'), dock: v('verdictDock') },
    explain: { opacity: v('explainOpacity'), bars: v('explainBars') },
    map: { opacity: v('mapOpacity'), locked: v('mapLocked') },
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
