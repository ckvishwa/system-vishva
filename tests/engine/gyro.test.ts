import { describe, it, expect } from 'vitest';
import { orientationToOffset, MAX_SHIFT_PX, lerp } from '../../src/engine/input/gyro';

describe('gyro (ARD L-04)', () => {
  it('phone at rest → no shift', () => expect(orientationToOffset(0, 45)).toEqual({ x: 0, y: 0 }));
  it('never exceeds the max shift', () => {
    const o = orientationToOffset(90, 180);
    expect(Math.abs(o.x)).toBeLessThanOrEqual(MAX_SHIFT_PX);
    expect(Math.abs(o.y)).toBeLessThanOrEqual(MAX_SHIFT_PX);
  });
  it('lerp moves part of the way', () => expect(lerp(0, 10, 0.1)).toBeCloseTo(1));
});
