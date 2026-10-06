/**
 * Keyframes over one global progress value (0..1). Every persistent element has a track of keys; sampling a track at a
 * progress gives its value. Each segment has its own easing, ease-in-out cubic unless a key says otherwise. Pure and
 * clock-free, so it is unit-tested at every key and in between.
 *
 * A key is [at, value, ease?]. `ease` shapes the segment that ARRIVES at the key.
 */
export type EaseName = 'linear' | 'in' | 'out' | 'inout';
export type Key = readonly [at: number, value: number, ease?: EaseName];

export const EASES: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - (1 - t) ** 3,
  inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

/** The value of `keys` at progress `p`: held before the first key and after the last. */
export function sample(keys: readonly Key[], p: number): number {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [at, v, e] = keys[i];
    if (p <= at) {
      const [a0, v0] = keys[i - 1];
      return v0 + (v - v0) * EASES[e ?? 'inout']((p - a0) / (at - a0));
    }
  }
  return keys[keys.length - 1][1];
}

/** Keys must be strictly increasing in `at`, or sampling would divide by zero. Returns a message or null. */
export function keyProblem(keys: readonly Key[]): string | null {
  for (let i = 1; i < keys.length; i++) if (!(keys[i][0] > keys[i - 1][0])) return `key ${i} at ${keys[i][0]} is not after ${keys[i - 1][0]}`;
  return keys.length ? null : 'no keys';
}
