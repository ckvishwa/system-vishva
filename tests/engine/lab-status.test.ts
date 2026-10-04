import { describe, it, expect } from 'vitest';
import { shownStatus, DORMANT_AFTER_DAYS } from '../../src/content/lab-status';

const now = Date.parse('2026-10-04');
const daysAgo = (d: number) => new Date(now - d * 864e5);

describe('lab status (DORMANT rule)', () => {
  it('active work touched within 90 days stays active', () => expect(shownStatus('active', daysAgo(DORMANT_AFTER_DAYS - 1), now)).toBe('active'));
  it('active work untouched for over 90 days is shown as dormant', () => expect(shownStatus('active', daysAgo(DORMANT_AFTER_DAYS + 1), now)).toBe('dormant'));
  it('other states are never rewritten', () => {
    for (const s of ['complete', 'paused', 'research']) expect(shownStatus(s, daysAgo(400), now)).toBe(s);
  });
});
