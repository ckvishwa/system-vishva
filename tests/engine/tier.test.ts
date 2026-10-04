import { describe, it, expect } from 'vitest';
import { decideTier, type Signals } from '../../src/engine/tier';

const base: Signals = { reducedMotion: false, saveData: false, webgl2: true, cores: 8, memoryGB: 8, coarsePointer: false };

describe('decideTier', () => {
  it('strong desktop → A', () => expect(decideTier(base)).toBe('A'));
  it('touch device → B', () => expect(decideTier({ ...base, coarsePointer: true })).toBe('B'));
  it('mid laptop → B', () => expect(decideTier({ ...base, cores: 6, memoryGB: 4 })).toBe('B'));
  it('reduced motion always wins → C', () => expect(decideTier({ ...base, reducedMotion: true })).toBe('C'));
  it('save-data → C', () => expect(decideTier({ ...base, saveData: true })).toBe('C'));
  it('no WebGL2 → C', () => expect(decideTier({ ...base, webgl2: false })).toBe('C'));
  it('weak phone → C', () => expect(decideTier({ ...base, coarsePointer: true, cores: 4 })).toBe('C'));
  it('2 GB device → C', () => expect(decideTier({ ...base, memoryGB: 2 })).toBe('C'));
  it('unknown memory (Safari) desktop → A', () => expect(decideTier({ ...base, memoryGB: null })).toBe('A'));
});
