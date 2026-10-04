import { describe, it, expect } from 'vitest';
import { inputOffset, layerShift, easeToward, MAX_SHIFT_PX, MAX_SCROLL_FRACTION, DEPTH } from '../../src/engine/fx/parallax';

describe('parallax (E2)', () => {
  it('pointer + gyro never exceed 12 px', () => {
    const o = inputOffset({ x: 1, y: -1 }, { x: 8, y: -8 });
    expect(Math.abs(o.x)).toBe(MAX_SHIFT_PX);
    expect(Math.abs(o.y)).toBe(MAX_SHIFT_PX);
  });

  it('far layers move less than near layers; text is the fixed plane', () => {
    expect(DEPTH.grid).toBeLessThan(DEPTH.graph);
    const o = { x: 12, y: 0 };
    expect(layerShift(o, DEPTH.grid, 0, 800).x).toBeLessThan(layerShift(o, DEPTH.graph, 0, 800).x);
  });

  it('scroll parallax is translateY only and capped at 15% of the viewport', () => {
    const t = layerShift({ x: 0, y: 0 }, 1, 5, 1000); // progress clamps to 1
    expect(t.x).toBe(0);
    expect(t.y).toBeCloseTo(MAX_SCROLL_FRACTION * 1000);
  });

  it('ease converges and is frame-rate independent', () => {
    let a = 0; for (let i = 0; i < 2; i++) a = easeToward(a, 10, 50);
    expect(easeToward(0, 10, 100)).toBeCloseTo(a);
    expect(easeToward(0, 10, 5000)).toBeCloseTo(10, 1);
  });
});
