/**
 * MalTrace teardown (ADR-0016): the sample dismantled layer by layer as the page scrolls. This file is the whole timeline,
 * as pure functions of progress (0..1 through the sticky stage). Nothing here touches the DOM or the clock, so every state
 * boundary is unit-tested. engine/motion/teardown.ts applies these numbers to the stage as transform, opacity and clip-path.
 *
 * Seven states, each owning one seventh of the scroll. A layer's value is a clamped segment of progress, so scrolling back
 * reassembles exactly what scrolling forward peeled off.
 */
import type { MotionIntent } from './tokens';

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
/** 0 before `a`, 1 after `b`, linear between. A seventh is one state; `u` converts "state k + fraction" to progress. */
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const u = (k: number) => k / STATE_COUNT;

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
  const fade = (inA: number, inB: number, outA: number, outB: number) => seg(p, inA, inB) * (1 - seg(p, outA, outB));
  return {
    index,
    local: clamp01(p * STATE_COUNT - index),
    hash: { settle: seg(p, 0, u(0.5)) },
    // CRACK opens the block a quarter of the way, DETONATE pulls it fully apart
    slabs: { opacity: 1 - seg(p, u(3), u(3.5)), gap: 0.25 * seg(p, u(1), u(2)) + 0.75 * seg(p, u(2), u(3)), labels: seg(p, u(1), u(1.5)) },
    stream: { opacity: fade(u(2), u(2.3), u(3), u(3.4)), bars: seg(p, u(2), u(3)), total: seg(p, u(2), u(3)) },
    grid: { opacity: fade(u(3), u(3.3), u(4.6), u(4.9)), assemble: seg(p, u(3), u(4)), converge: seg(p, u(4), u(4.75)) },
    model: { opacity: fade(u(4), u(4.4), u(5), u(5.4)) },
    verdict: { opacity: seg(p, u(4.5), u(4.6)), reveal: seg(p, u(4.5), u(5)), dock: seg(p, u(5), u(5.5)) },
    explain: { opacity: fade(u(5), u(5.4), u(6), u(6.2)), bars: seg(p, u(5), u(6)) },
    map: { opacity: seg(p, u(6), u(6.3)), locked: seg(p, u(6), 1) },
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
