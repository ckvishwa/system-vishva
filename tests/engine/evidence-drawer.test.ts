import { describe, it, expect } from 'vitest';
import { drawerRows, readClaim, openDrawer, type DrawerClaim } from '../../src/engine/evidence-drawer';

const base = { label: 'Automated tests', display: '1,020' };
const texts = (c: DrawerClaim) => drawerRows(c).map((r) => r.text);

describe('drawer rows by evidence kind', () => {
  it('public: the source, as a link', () => {
    const rows = drawerRows({ ...base, kind: 'public', evidence: 'https://github.com/o/r/blob/abc/README.md' });
    expect(rows[0].text).toBe('Public source');
    expect(rows[1]).toEqual({ text: 'github.com/o/r/blob/abc/README.md', href: 'https://github.com/o/r/blob/abc/README.md' });
  });
  it('self-hosted: says the repo is private and the output is published', () => {
    const rows = drawerRows({ ...base, kind: 'self-hosted', evidence: '/evidence/rexi/a.txt' });
    expect(rows[0].text).toBe('source: private repo, output published');
    expect(rows[1].href).toBe('/evidence/rexi/a.txt');
  });
  it('on-request: says so, and never links a file', () => {
    const rows = drawerRows({ ...base, kind: 'on-request', evidence: undefined });
    expect(rows[0]).toEqual({ text: 'available on request', tone: 'info' });
    expect(rows.filter((r) => r.href).map((r) => r.href)).toEqual(['/contact/']);
  });
  it('pending: evidence pending', () => expect(texts({ ...base, kind: 'pending' })[0]).toBe('evidence pending'));
  it('adds the note and the measured date when present', () => {
    expect(texts({ ...base, kind: 'on-request', note: 'A note.', measuredOn: '2026-10-05' }).slice(-2)).toEqual(['A note.', 'measured 2026-10-05']);
  });
  it('drops any link that is not https or a site path', () => {
    for (const evidence of ['javascript:alert(1)', 'http://x.test/a', '//evil.test/a', 'data:text/html,x'])
      expect(drawerRows({ ...base, kind: 'public', evidence }).every((r) => !r.href), evidence).toBe(true);
  });
});

describe('drawer dom', () => {
  const fig = () => {
    document.body.innerHTML = '<figure data-claim data-label="Pricing" data-display="50/50" data-kind="self-hosted" data-evidence="/evidence/a.txt" data-measured="2026-10-05"><button data-evidence-open>50/50</button></figure>';
    return document.querySelector<HTMLElement>('[data-evidence-open]')!;
  };
  it('reads the claim from the metric it opened from', () => {
    expect(readClaim(fig())).toMatchObject({ label: 'Pricing', display: '50/50', kind: 'self-hosted', evidence: '/evidence/a.txt', measuredOn: '2026-10-05' });
  });
  it('builds an accessible dialog with textContent only', () => {
    const t = fig();
    (HTMLDialogElement.prototype as any).showModal = function () { this.open = true; };
    (HTMLDialogElement.prototype as any).close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
    openDrawer(t);
    const d = document.querySelector('dialog.drawer')!;
    expect(d.getAttribute('role')).toBe('dialog');
    expect(document.getElementById(d.getAttribute('aria-labelledby')!)!.textContent).toBe('50/50 Pricing');
    expect(d.textContent).toContain('source: private repo, output published');
    openDrawer(t); // a second open does not stack
    expect(document.querySelectorAll('dialog.drawer')).toHaveLength(1);
    (d as HTMLDialogElement).close();
    expect(document.querySelector('dialog.drawer')).toBeNull();
  });
});
