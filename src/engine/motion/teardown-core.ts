/**
 * What the running MalTrace teardown needs from the timeline, and nothing else: the state names, the progress maths, and the
 * function that turns progress into every layer's value given the keyframe tracks. The tracks themselves (teardown-state.ts) are
 * data: Teardown.astro serialises them into the page payload, so they cost the lazy script nothing. Tests and the build use
 * teardown-state.ts, which binds this function to those same tracks: there is one timeline.
 */
import type { MotionIntent } from './tokens';
import { sample, type Key } from './keyframes';

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

export const W = 1 / STATE_COUNT;

export interface Layers {
  /** 0..8, the state the scroll is in */
  index: number;
  /** 0..1 within that state */
  local: number;
  hash: { settle: number };
  cam: { scale: number; y: number };
  shell: { fill: number; edge: number };
  rail: number;
  leader: number;
  scan: number;
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
export function layersFrom(progress: number, TRACKS: Record<string, readonly Key[]>): Layers {
  const p = Number.isFinite(progress) ? clamp01(progress) : 0;
  const at = p * STATE_COUNT + 1e-9; // 7/9 * 9 is 6.999...: nudge so a boundary belongs to the state it starts
  const index = Math.min(STATE_COUNT - 1, Math.floor(at));
  const out: Record<string, any> = { index, local: clamp01(at - index) };
  for (const k of Object.keys(TRACKS)) {
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
