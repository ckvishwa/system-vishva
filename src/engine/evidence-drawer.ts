/**
 * Evidence drawer (ARD §7 idea 2). Lazy-loaded on the first click of a metric by islands/EvidenceDrawer.astro, so it
 * adds nothing before first paint. It shows one claim's evidence by what kind it really is (ADR-0015):
 *   public       a link to the public artifact
 *   self-hosted  "source: private repo, output published", with the published file
 *   on-request   "available on request", with no link to a file that does not exist
 * Everything it prints was written into the page by ClaimRef.astro from claims.yaml (data-* on the metric).
 *
 * Accessibility: a native <dialog> opened with showModal(): role="dialog", the page behind is inert, Tab stays inside,
 * Esc closes, and focus returns to the metric that opened it. No animation, nothing to disable for reduced motion.
 */
export interface DrawerClaim {
  label: string;
  display: string;
  kind: 'public' | 'self-hosted' | 'on-request' | 'pending';
  evidence?: string;
  note?: string;
  measuredOn?: string;
}

type Row = { text: string; href?: string; tone?: 'ok' | 'info' | 'muted' };
const SAFE_HREF = /^(https:\/\/|\/(?!\/))/;

/** The rows the drawer shows. Pure, so the wording is unit-tested. */
export function drawerRows(c: DrawerClaim): Row[] {
  const rows: Row[] = [];
  if (c.kind === 'public' && c.evidence) rows.push({ text: 'Public source', tone: 'ok' }, { text: c.evidence.replace(/^https?:\/\//, ''), href: c.evidence });
  else if (c.kind === 'self-hosted' && c.evidence) rows.push({ text: 'source: private repo, output published', tone: 'ok' }, { text: 'Open the published output', href: c.evidence });
  else if (c.kind === 'on-request') rows.push({ text: 'available on request', tone: 'info' }, { text: 'No public artifact. Ask for the output.', href: '/contact/' });
  else rows.push({ text: 'evidence pending', tone: 'muted' });
  if (c.note) rows.push({ text: c.note });
  if (c.measuredOn) rows.push({ text: `measured ${c.measuredOn}`, tone: 'muted' });
  // Never render a link that is not https or a site path.
  return rows.map((r) => (r.href && !SAFE_HREF.test(r.href) ? { text: r.text, tone: r.tone } : r));
}

export function readClaim(trigger: HTMLElement): DrawerClaim | null {
  const f = trigger.closest<HTMLElement>('[data-claim]');
  if (!f) return null;
  const d = f.dataset;
  return { label: d.label ?? '', display: d.display ?? '', kind: (d.kind as DrawerClaim['kind']) ?? 'pending', evidence: d.evidence, note: d.note, measuredOn: d.measured };
}

export function openDrawer(trigger: HTMLElement): void {
  const claim = readClaim(trigger);
  if (!claim || document.querySelector('dialog.drawer')) return;

  const dlg = document.createElement('dialog');
  dlg.className = 'drawer';
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-labelledby', 'drawer-h');

  const head = document.createElement('div');
  head.className = 'drawer-head mono';
  const h = document.createElement('h2');
  h.id = 'drawer-h';
  h.className = 'mono';
  h.textContent = `${claim.display} ${claim.label}`;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'term-close mono';
  x.textContent = 'Close (Esc)';
  x.addEventListener('click', () => dlg.close());
  head.append(h, x);

  const body = document.createElement('div');
  body.className = 'drawer-body mono';
  for (const r of drawerRows(claim)) {
    const p = document.createElement('p');
    if (r.tone) p.className = `t-${r.tone}`;
    if (r.href) {
      const a = document.createElement('a');
      a.href = r.href;
      a.textContent = r.text;
      if (r.href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; }
      p.append(a);
    } else p.textContent = r.text;
    body.append(p);
  }

  dlg.append(head, body);
  dlg.addEventListener('close', () => { dlg.remove(); trigger.focus(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // a click on the backdrop
  // Focus trap: a native modal keeps the page inert, but Tab can still leave for the browser's own UI. Wrap it.
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...dlg.querySelectorAll<HTMLElement>('a[href], button')];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.body.append(dlg);
  dlg.showModal();
}
