/**
 * Depth by parallax (meaning: hierarchy). Far layers move less, text never moves.
 * Inputs arrive from input/pointer.ts, input/gyro.ts and input/scroll.ts; this module owns
 * the single shared ease and writes transform only (compositor-friendly).
 */
export const MAX_SHIFT_PX = 12;          // pointer / gyro cap
export const MAX_SCROLL_FRACTION = 0.15; // scroll translateY cap, as a share of the viewport height
export const DEPTH = { grid: 0.2, graph: 0.5, text: 1 } as const; // text is the fixed reference plane
const TAU_MS = 140;

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

/** The shared lerp: frame-rate independent exponential ease toward a target. */
export const easeToward = (cur: number, target: number, dt: number, tau = TAU_MS) =>
  cur + (target - cur) * (1 - Math.exp(-dt / tau));

/** Pointer (-1..1) and gyro (px) combine into one px offset, clamped per axis. */
export function inputOffset(pointer: { x: number; y: number }, tilt: { x: number; y: number }) {
  return {
    x: clamp(pointer.x * MAX_SHIFT_PX + tilt.x, MAX_SHIFT_PX),
    y: clamp(pointer.y * MAX_SHIFT_PX + tilt.y, MAX_SHIFT_PX),
  };
}

/** Translation for one layer. `scroll` is progress 0..1 through the parallax range. */
export function layerShift(offset: { x: number; y: number }, depth: number, scroll: number, viewportH: number) {
  const s = Math.max(0, Math.min(1, scroll));
  return { x: offset.x * depth, y: offset.y * depth + s * MAX_SCROLL_FRACTION * viewportH * depth };
}

export interface Layer { el: HTMLElement; depth: number }

export function createParallax(layers: Layer[], viewportH = innerHeight) {
  const pointer = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };
  let scroll = 0;
  let vh = viewportH;
  const target = { x: 0, y: 0, s: 0 };
  const cur = { x: 0, y: 0, s: 0 };

  const retarget = () => { const o = inputOffset(pointer, tilt); target.x = o.x; target.y = o.y; target.s = scroll; };
  const apply = () => {
    for (const { el, depth } of layers) {
      const t = layerShift(cur, depth, cur.s, vh);
      el.style.transform = `translate3d(${t.x.toFixed(2)}px, ${t.y.toFixed(2)}px, 0)`;
    }
  };

  return {
    setPointer(x: number, y: number) { pointer.x = x; pointer.y = y; retarget(); },
    setTilt(x: number, y: number) { tilt.x = x; tilt.y = y; retarget(); },
    setScroll(progress: number) { scroll = progress; retarget(); },
    resize(h: number) { vh = h; },
    /** Advance the ease. Returns true while still moving. */
    step(dt: number): boolean {
      cur.x = easeToward(cur.x, target.x, dt);
      cur.y = easeToward(cur.y, target.y, dt);
      cur.s = easeToward(cur.s, target.s, dt);
      const moving = Math.abs(target.x - cur.x) > 0.01 || Math.abs(target.y - cur.y) > 0.01 || Math.abs(target.s - cur.s) > 0.0005;
      if (!moving) { cur.x = target.x; cur.y = target.y; cur.s = target.s; }
      apply();
      return moving;
    },
    dispose() { for (const { el } of layers) el.style.transform = ''; },
  };
}
