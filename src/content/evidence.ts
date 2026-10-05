// ADR-0015: one definition of what a claim's evidence means. Plain TS so scripts, pages and tests share it.
export type EvidenceKind = 'public' | 'self-hosted' | 'on-request';
export type EvidenceInput = { evidence: string | null; evidenceKind?: EvidenceKind };
export type EvidenceState = 'verified' | 'on-request' | 'unverified';

/** The declared kind, or the kind the evidence implies (a site path is self-hosted, a URL is public). */
export function kindOf(c: EvidenceInput): EvidenceKind | null {
  if (c.evidenceKind) return c.evidenceKind;
  if (!c.evidence) return null;
  return c.evidence.startsWith('/') ? 'self-hosted' : 'public';
}

/** verified = a public or self-hosted artifact exists; on-request = declared, no artifact; unverified = neither. */
export function stateOf(c: EvidenceInput): EvidenceState {
  const kind = kindOf(c);
  if (kind === 'on-request') return c.evidence ? 'unverified' : 'on-request';
  return c.evidence && kind ? 'verified' : 'unverified';
}

/** Why a claim's kind and evidence disagree, or null when they are consistent. */
export function kindProblem(c: EvidenceInput): string | null {
  const kind = kindOf(c);
  if (kind === 'on-request' && c.evidence) return 'evidenceKind on-request but evidence is set';
  if (kind === 'self-hosted' && !c.evidence?.startsWith('/')) return 'evidenceKind self-hosted needs a /path';
  if (kind === 'public' && !/^https?:\/\//.test(c.evidence ?? '')) return 'evidenceKind public needs an http(s) URL';
  return null;
}
