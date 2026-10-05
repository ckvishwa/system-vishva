import { describe, it, expect, vi } from 'vitest';
import { counts, offlineProblems, onlineProblems, type Claim } from '../../scripts/claims-lib';
import { stateOf } from '../../src/content/evidence';

const c = (o: Partial<Claim>): Claim => ({ id: 'x', label: 'L', display: '1', evidence: null, ...o });
const URL = 'https://github.com/o/r/blob/abc/README.md';
const dist = (files: string[]) => (p: string) => files.includes(p);
const res = (status: number, url = URL) => Promise.resolve({ status, url });

describe('evidence state', () => {
  it('infers kind from the evidence, and treats on-request as its own state', () => {
    expect(stateOf(c({ evidence: URL }))).toBe('verified');
    expect(stateOf(c({ evidence: '/evidence/a.txt' }))).toBe('verified');
    expect(stateOf(c({ evidence: null }))).toBe('unverified');
    expect(stateOf(c({ evidence: null, evidenceKind: 'on-request' }))).toBe('on-request');
    expect(stateOf(c({ evidence: URL, evidenceKind: 'on-request' }))).toBe('unverified');
  });
  it('counts verified, on-request and unverified separately', () => {
    const n = counts([c({ evidence: URL }), c({ evidenceKind: 'on-request' }), c({ evidenceKind: 'on-request' }), c({})]);
    expect(n).toEqual({ verified: 1, onRequest: 2, unverified: 1 });
  });
});

describe('offline claim problems', () => {
  it('allows on-request, blocks unverified and kind/evidence mismatches', () => {
    expect(offlineProblems([c({ evidenceKind: 'on-request' }), c({ evidence: URL })])).toEqual([]);
    expect(offlineProblems([c({ id: 'a' })])[0]).toMatch(/unverified\s+a/);
    expect(offlineProblems([c({ id: 'b', evidence: URL, evidenceKind: 'on-request' })])[0]).toMatch(/inconsistent b/);
    expect(offlineProblems([c({ id: 'd', evidence: URL, evidenceKind: 'self-hosted' })])[0]).toMatch(/inconsistent d/);
    expect(offlineProblems([c({ id: 'e', evidence: '/x.txt', evidenceKind: 'public' })])[0]).toMatch(/inconsistent e/);
  });
});

describe('--online evidence check (mocked fetch)', () => {
  it('passes on 200 and sends no credentials', async () => {
    const fetch = vi.fn(() => res(200));
    expect(await onlineProblems([c({ evidence: URL })], { fetch, distHas: dist([]) })).toEqual([]);
    const init = (fetch.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.headers).toEqual({ Cookie: '', Authorization: '' });
  });
  it('fails on 404 (what a private repo answers anonymously)', async () => {
    const out = await onlineProblems([c({ id: 'p', evidence: URL })], { fetch: () => res(404), distHas: dist([]) });
    expect(out).toEqual([`http 404    p: ${URL}`]);
  });
  it('fails on a redirect that lands on a login page', async () => {
    const out = await onlineProblems([c({ id: 'p', evidence: URL })], { fetch: () => res(200, 'https://github.com/login?return_to=x'), distHas: dist([]) });
    expect(out[0]).toMatch(/login wall\s+p/);
  });
  it('fails when the request throws', async () => {
    const out = await onlineProblems([c({ id: 'p', evidence: URL })], { fetch: () => Promise.reject(new Error('boom')), distHas: dist([]) });
    expect(out[0]).toMatch(/unreachable p.*boom/);
  });
  it('checks self-hosted files in dist/ without fetching', async () => {
    const fetch = vi.fn(() => res(200));
    const claims = [c({ id: 's', evidence: '/evidence/rexi/a.txt', evidenceKind: 'self-hosted' })];
    expect(await onlineProblems(claims, { fetch, distHas: dist(['/evidence/rexi/a.txt']) })).toEqual([]);
    expect((await onlineProblems(claims, { fetch, distHas: dist([]) }))[0]).toMatch(/missing\s+s/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('skips on-request claims', async () => {
    const fetch = vi.fn(() => res(404));
    expect(await onlineProblems([c({ evidenceKind: 'on-request' })], { fetch, distHas: dist([]) })).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
