/** Pure checks behind verify-claims.ts, split out so they can be unit-tested with a mocked fetch. */
import { kindOf, kindProblem, stateOf, type EvidenceKind } from '../src/content/evidence';

export type Claim = { id: string; label: string; display: string; evidence: string | null; evidenceKind?: EvidenceKind };

export function offlineProblems(claims: Claim[]): string[] {
  const out: string[] = [];
  for (const c of claims) {
    const bad = kindProblem(c);
    if (bad) out.push(`inconsistent ${c.id}: ${bad}`);
    else if (stateOf(c) === 'unverified') out.push(`unverified  ${c.id} (${c.display} ${c.label})`);
  }
  return out;
}

export type OnlineDeps = {
  fetch: (url: string, init?: RequestInit) => Promise<Pick<Response, 'status' | 'url'>>;
  distHas: (path: string) => boolean;
};

const LOGIN = /\/(login|sign_in|signin|session|sso)(\/|\?|$)/i;

/** Public: anonymous GET must end at 200 on the same page, not a login wall. Self-hosted: the file must be in dist/. */
export async function onlineProblems(claims: Claim[], deps: OnlineDeps): Promise<string[]> {
  const out: string[] = [];
  for (const c of claims) {
    if (!c.evidence) continue; // on-request has no artifact to check
    const kind = kindOf(c);
    if (kind === 'self-hosted') {
      if (!deps.distHas(c.evidence)) out.push(`missing     ${c.id}: ${c.evidence} not in dist/`);
    } else if (kind === 'public') {
      try {
        const r = await deps.fetch(c.evidence, { redirect: 'follow', headers: { Cookie: '', Authorization: '' } });
        if (r.status !== 200) out.push(`http ${r.status}    ${c.id}: ${c.evidence}`);
        else if (LOGIN.test(new URL(r.url || c.evidence).pathname)) out.push(`login wall  ${c.id}: ${c.evidence} redirects to ${r.url}`);
      } catch (e) {
        out.push(`unreachable ${c.id}: ${c.evidence} (${(e as Error).message})`);
      }
    }
  }
  return out;
}

export function counts(claims: Claim[]) {
  const n = { verified: 0, onRequest: 0, unverified: 0 };
  for (const c of claims) {
    const s = stateOf(c);
    if (s === 'verified') n.verified++; else if (s === 'on-request') n.onRequest++; else n.unverified++;
  }
  return n;
}
