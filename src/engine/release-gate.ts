/**
 * The release-gate rule, as a pure function. It mirrors how this site's real gate (scripts/gate.ts, shown on /status)
 * decides: every check needs evidence, and any check that fails or has no evidence blocks the release.
 * The ReleaseGateDemo island feeds it simulated inputs; nothing here measures anything.
 */
export const CHECKS = [
  { id: 'claims', label: 'Claims verified' },
  { id: 'tests', label: 'Unit tests' },
  { id: 'budget', label: 'JS budgets' },
  { id: 'e2e', label: 'End-to-end tests' },
] as const;

export type CheckId = (typeof CHECKS)[number]['id'];
/** What the evidence for one check says: it passed, it failed, or there is no evidence at all. */
export type Evidence = 'pass' | 'fail' | 'missing';
export const EVIDENCE: readonly Evidence[] = ['pass', 'fail', 'missing'];

export type Inputs = Record<CheckId, Evidence>;
export interface Reason { id: CheckId; label: string; why: 'failing' | 'no evidence' }
export interface Verdict { decision: 'SHIP' | 'BLOCK'; reasons: Reason[] }

export function decide(inputs: Inputs): Verdict {
  const reasons: Reason[] = [];
  for (const c of CHECKS) {
    const e = inputs[c.id];
    if (e === 'fail') reasons.push({ id: c.id, label: c.label, why: 'failing' });
    else if (e !== 'pass') reasons.push({ id: c.id, label: c.label, why: 'no evidence' }); // anything unrecognised is unverified
  }
  return { decision: reasons.length === 0 ? 'SHIP' : 'BLOCK', reasons };
}

export const allPass = (): Inputs => ({ claims: 'pass', tests: 'pass', budget: 'pass', e2e: 'pass' });
