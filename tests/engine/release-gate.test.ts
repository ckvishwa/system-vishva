import { describe, it, expect } from 'vitest';
import { CHECKS, EVIDENCE, allPass, decide, type CheckId, type Evidence, type Inputs } from '../../src/engine/release-gate';

/** Every combination of the four checks: 3^4 = 81. */
const combos: Inputs[] = [];
for (const claims of EVIDENCE) for (const tests of EVIDENCE) for (const budget of EVIDENCE) for (const e2e of EVIDENCE) combos.push({ claims, tests, budget, e2e });

describe('release-gate rule', () => {
  it('covers all 81 combinations', () => expect(new Set(combos.map((c) => JSON.stringify(c))).size).toBe(81));

  it('SHIP exactly when every check passes, BLOCK in the other 80', () => {
    const ships = combos.filter((c) => decide(c).decision === 'SHIP');
    expect(ships).toEqual([allPass()]);
    expect(combos.filter((c) => decide(c).decision === 'BLOCK')).toHaveLength(80);
  });

  it.each(combos.map((c) => [JSON.stringify(c), c] as const))('%s: reasons are exactly the checks that fail or lack evidence', (_, c) => {
    const v = decide(c);
    const expected = CHECKS.filter((k) => c[k.id] !== 'pass').map((k) => ({ id: k.id, why: c[k.id] === 'fail' ? 'failing' : 'no evidence' }));
    expect(v.reasons.map((r) => ({ id: r.id, why: r.why }))).toEqual(expected);
    expect(v.decision).toBe(expected.length ? 'BLOCK' : 'SHIP');
  });

  it('missing evidence blocks just like a failure does', () => {
    for (const id of CHECKS.map((c) => c.id) as CheckId[]) {
      expect(decide({ ...allPass(), [id]: 'missing' }).decision).toBe('BLOCK');
      expect(decide({ ...allPass(), [id]: 'fail' }).decision).toBe('BLOCK');
    }
  });

  it('treats an unrecognised value as no evidence, never as a pass', () => {
    const v = decide({ ...allPass(), e2e: 'green' as Evidence });
    expect(v.decision).toBe('BLOCK');
    expect(v.reasons).toEqual([{ id: 'e2e', label: 'End-to-end tests', why: 'no evidence' }]);
  });

  it('is pure: the same inputs give the same verdict and are not mutated', () => {
    const i = allPass();
    const copy = JSON.stringify(i);
    expect(decide(i)).toEqual(decide(i));
    expect(JSON.stringify(i)).toBe(copy);
  });
});
