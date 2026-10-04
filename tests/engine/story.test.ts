import { describe, it, expect } from 'vitest';
import { parseRange, activeCount, pipelineState, traceOn, threshold } from '../../src/engine/motion/story';

describe('scroll story maths', () => {
  it('parses 1-based inclusive ranges as printed on the diagram', () => {
    expect(parseRange('1-3', 8)).toEqual([0, 2]);
    expect(parseRange('4-6', 8)).toEqual([3, 5]);
  });
  it('rejects ranges outside the pipeline', () => {
    expect(() => parseRange('0-2', 8)).toThrow();
    expect(() => parseRange('5-9', 8)).toThrow();
    expect(() => parseRange('3-1', 8)).toThrow();
    expect(() => parseRange('x', 8)).toThrow();
  });

  it('nothing is on before the beat is reached, everything is on at the end', () => {
    expect(activeCount(0, 3)).toBe(0);
    expect(activeCount(1, 3)).toBe(3);
  });
  it('nodes switch on strictly in order as progress grows', () => {
    for (let j = 1; j < 5; j++) expect(threshold(j, 5)).toBeGreaterThan(threshold(j - 1, 5));
    let prev = 0;
    for (let p = 0; p <= 1; p += 0.01) { const c = activeCount(p, 5); expect(c).toBeGreaterThanOrEqual(prev); prev = c; }
  });
  it('is a pure function of progress, so scrolling back turns nodes off again', () => {
    expect(activeCount(0.5, 4)).toBe(activeCount(0.5, 4));
    expect(activeCount(0.1, 4)).toBeLessThan(activeCount(0.9, 4));
  });

  const groups = (p1: number, p2: number) => [
    { range: [0, 2] as [number, number], progress: p1 },
    { range: [3, 5] as [number, number], progress: p2 },
  ];
  it('lights group 1 before group 2 and never group 2 first', () => {
    const on = pipelineState(8, groups(1, 0));
    expect(on.slice(0, 3)).toEqual([true, true, true]);
    expect(on.slice(3)).toEqual(new Array(5).fill(false));
  });
  it('the tail nodes (after the last group) are lit by the last group and complete the pipeline', () => {
    expect(pipelineState(8, groups(1, 1))).toEqual(new Array(8).fill(true));
    expect(pipelineState(8, groups(1, 0.1)).slice(6)).toEqual([false, false]);
  });
  it('a connector draws once the node it leads into is on', () => {
    const on = pipelineState(8, groups(1, 0));
    expect(traceOn(on, 1)).toBe(true);   // STT <- VAD
    expect(traceOn(on, 2)).toBe(false);  // Interpreter not yet on
  });
});
