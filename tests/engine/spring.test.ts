import { describe, it, expect } from 'vitest';
import { springStep, settled, OMEGA, REST, type Spring } from '../../src/engine/motion/spring';

/** Run the spring at a fixed frame time until it settles; returns every x and the frame count. */
function run(from: Spring, target: number, frameMs = 16.7, limit = 5000) {
  let s = from;
  const xs = [s.x];
  let frames = 0;
  while (!settled(s, target) && frames < limit) { s = springStep(s, target, frameMs / 1000); xs.push(s.x); frames++; }
  return { xs, frames, end: s };
}

describe('critically damped spring', () => {
  it('converges to the target and reports settled', () => {
    const { frames, end } = run({ x: 0, v: 0 }, 1);
    expect(frames).toBeLessThan(120); // about 2 s at 60 fps, well inside the limit
    expect(Math.abs(end.x - 1)).toBeLessThan(REST.x);
    expect(Math.abs(end.v)).toBeLessThan(REST.v);
  });

  it('never overshoots when it starts from rest, in either direction', () => {
    for (const [from, to] of [[0, 1], [1, 0], [0.2, 0.9], [0.9, 0.2]] as const) {
      const { xs } = run({ x: from, v: 0 }, to);
      for (const x of xs) expect(to > from ? x <= to + 1e-12 : x >= to - 1e-12, `${from}->${to} at ${x}`).toBe(true);
      // and it is monotone: it only ever moves toward the target
      for (let i = 1; i < xs.length; i++) expect(to > from ? xs[i] >= xs[i - 1] - 1e-12 : xs[i] <= xs[i - 1] + 1e-12).toBe(true);
    }
  });

  it('glides: a jump in the target moves a little each frame, never all at once', () => {
    const first = springStep({ x: 0, v: 0 }, 1, 0.0167);
    expect(first.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(0.05); // a burst of wheel steps cannot teleport the picture
  });

  it('is exact: two half steps equal one whole step, so frame time cannot change the path', () => {
    const whole = springStep({ x: 0, v: 0 }, 1, 0.05);
    const half = springStep(springStep({ x: 0, v: 0 }, 1, 0.025), 1, 0.025);
    expect(half.x).toBeCloseTo(whole.x, 12);
    expect(half.v).toBeCloseTo(whole.v, 12);
  });

  it('stays stable across a very long frame (a hidden tab)', () => {
    const s = springStep({ x: 0, v: 0 }, 1, 5);
    expect(s.x).toBeCloseTo(1, 6);
    expect(Number.isFinite(s.v)).toBe(true);
  });

  it('sleeps: settled only when both close and slow; at rest on target it stays put', () => {
    expect(settled({ x: 1, v: 0 }, 1)).toBe(true);
    expect(settled({ x: 1 - REST.x / 2, v: REST.v / 2 }, 1)).toBe(true);
    expect(settled({ x: 1 - REST.x * 2, v: 0 }, 1)).toBe(false);   // close enough to look done is not enough: still too far
    expect(settled({ x: 1, v: REST.v * 2 }, 1)).toBe(false);       // on the target but still moving
    const s = springStep({ x: 1, v: 0 }, 1, 0.0167);
    expect(s).toEqual({ x: 1, v: 0 });
  });

  it('the threshold the brief asks for is 0.0005', () => expect(REST.x).toBe(0.0005));

  it('a target that keeps moving (steady scroll) is tracked with a small, steady lag', () => {
    let s: Spring = { x: 0, v: 0 };
    let target = 0;
    for (let f = 0; f < 120; f++) { target += 0.004; s = springStep(s, target, 0.0167); }
    const lag = target - s.x;
    expect(lag).toBeGreaterThan(0);
    expect(lag).toBeLessThan(0.05); // trails the scroll, never wanders off
  });

  it('natural frequency is the documented one', () => expect(OMEGA).toBe(10));
});
