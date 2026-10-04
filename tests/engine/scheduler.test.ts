import { describe, it, expect } from 'vitest';
import { createScheduler } from '../../src/engine/scheduler';

/** Manual frame driver so the loop is deterministic. */
function harness() {
  let queued: FrameRequestCallback | null = null;
  let t = 0;
  const s = createScheduler((cb) => { queued = cb; return 1; }, () => { queued = null; });
  const step = () => { const cb = queued; queued = null; t += 16; cb?.(t); };
  return { s, step, pending: () => queued !== null };
}

describe('scheduler (ARD §5)', () => {
  it('sleeps when nothing is dirty — idle page renders 0 frames', () => {
    const { s, step, pending } = harness();
    let calls = 0;
    s.add('a', () => { calls++; return false; });
    step();
    expect(calls).toBe(1);
    expect(pending()).toBe(false);
  });

  it('keeps running while a subscriber stays dirty', () => {
    const { s, step, pending } = harness();
    let n = 0;
    s.add('a', () => ++n < 3);
    step(); step(); step();
    expect(n).toBe(3);
    expect(pending()).toBe(false);
  });

  it('invalidate wakes a sleeping loop', () => {
    const { s, step, pending } = harness();
    let calls = 0;
    s.add('a', () => { calls++; return false; });
    step();
    s.invalidate('a');
    expect(pending()).toBe(true);
    step();
    expect(calls).toBe(2);
  });

  it('pause stops frames; resume restarts only if dirty', () => {
    const { s, step, pending } = harness();
    s.add('a', () => true);
    s.pause();
    expect(pending()).toBe(false);
    s.resume();
    expect(pending()).toBe(true);
    step();
  });

  it('destroy clears every subscriber (no leaks across navigation)', () => {
    const { s } = harness();
    s.add('a', () => true); s.add('b', () => true);
    s.destroy();
    expect(s.size).toBe(0);
  });
});
