import { describe, it, expect } from 'vitest';
import { createIdleTimer, DRIFT_MS } from '../../src/engine/idle';

describe('idle drift timer', () => {
  it('drifts for 6 seconds, then sleeps', () => {
    expect(DRIFT_MS).toBe(6000);
    const t = createIdleTimer();
    expect(t.tick(5999)).toBe(true);
    expect(t.tick(1)).toBe(false);
    expect(t.active).toBe(false);
  });

  it('stays asleep until woken', () => {
    const t = createIdleTimer(100);
    t.tick(200);
    expect(t.tick(16)).toBe(false);
    t.wake();
    expect(t.active).toBe(true);
    expect(t.remaining).toBe(100);
  });

  it('wake mid-drift restarts the full window', () => {
    const t = createIdleTimer(1000);
    t.tick(900);
    t.wake();
    expect(t.tick(900)).toBe(true);
  });
});
