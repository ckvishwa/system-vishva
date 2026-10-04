import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { waveformPoints, waveformPath } from '../../src/engine/transitions/waveform';
import { signatureFor, TIMING, TOTAL_MS } from '../../src/engine/transitions/signatures';

describe('waveform shape', () => {
  it('is deterministic', () => expect(waveformPath(300, 32)).toBe(waveformPath(300, 32)));

  it('starts and ends on the centre line, so it settles into a straight pipeline', () => {
    const pts = waveformPoints(300, 32);
    expect(pts[0][1]).toBeCloseTo(16);
    expect(pts.at(-1)![1]).toBeCloseTo(16);
  });

  it('stays inside its box and spans the full width', () => {
    const pts = waveformPoints(300, 32);
    expect(pts[0][0]).toBe(0);
    expect(pts.at(-1)![0]).toBeCloseTo(300);
    pts.forEach(([, y]) => { expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(32); });
  });

  it('actually swings (it is a waveform, not a line)', () => {
    const ys = waveformPoints(300, 32).map(([, y]) => y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(10);
  });
});

describe('signature registry', () => {
  it('resolves waveform', () => expect(signatureFor('waveform')?.id).toBe('waveform'));
  it('unknown or not-yet-built signatures navigate normally', () => {
    expect(signatureFor('hash')).toBeNull();
    expect(signatureFor('nope')).toBeNull();
    expect(signatureFor(undefined)).toBeNull();
  });
});

describe('transition budget', () => {
  it('stays under 700 ms end to end', () => expect(TOTAL_MS).toBeLessThanOrEqual(700));

  it('transitions.css uses the same morph duration as TIMING', () => {
    const css = readFileSync('src/styles/transitions.css', 'utf8');
    expect(css).toContain(`animation-duration: ${TIMING.morph}ms`);
  });

  it('reduced motion and tier C disable pseudo-element animation', () => {
    const css = readFileSync('src/styles/transitions.css', 'utf8');
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none !important/);
    expect(css).toContain("html[data-tier='C']::view-transition-old(*)");
  });
});
