/**
 * A critically damped spring, solved exactly (no integration error, so a long frame cannot make it unstable).
 * The teardown shows `x`, which chases the scroll-derived target: wheel steps and trackpad bursts glide instead of jumping,
 * and a critically damped spring never overshoots when it starts from rest. It reports when it has settled, so the shared
 * scheduler can sleep and an idle page renders 0 frames.
 */
export interface Spring { x: number; v: number }

/** Natural frequency, rad/s. The glide settles in roughly 0.8 s. */
export const OMEGA = 10;
/** Settled when closer than this to the target and this slow. */
export const REST = { x: 0.0005, v: 0.002 } as const;

/** Advance `s` toward `target` by `dt` seconds. x(t) = target + (d + (v0 + w d) t) e^(-w t). */
export function springStep(s: Spring, target: number, dt: number, omega = OMEGA): Spring {
  const d = s.x - target;
  const c = s.v + omega * d;
  const e = Math.exp(-omega * dt);
  return { x: target + (d + c * dt) * e, v: (s.v - omega * c * dt) * e };
}

export const settled = (s: Spring, target: number) => Math.abs(target - s.x) < REST.x && Math.abs(s.v) < REST.v;
