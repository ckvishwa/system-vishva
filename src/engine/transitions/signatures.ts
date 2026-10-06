/**
 * Page-transition signatures (ARD §7 idea 4). A signature turns a source on the outgoing page
 * into a named view-transition element ("sig-line") that morphs into a target on the incoming
 * page. The glitch (E5) is a phase of every signature, not a separate effect: the outgoing title
 * is renamed "sig-title" so fx.css can play its 3-frame slice offset inside the window.
 *
 * Unknown signatures, and a signature whose real input is missing (`ready` false), navigate normally.
 */
import { waveformPath } from './waveform';
import { isSha256, hashLabel } from './hash';
import { EASE } from '../motion/tokens';

export type SignatureId = 'waveform' | 'hash' | 'stream' | 'stamp';

/** Phase budget in ms. fx.css repeats `morph`; a test keeps them in sync. Total stays under 700. */
export const TIMING = { form: 180, morph: 280 } as const;
export const TOTAL_MS = TIMING.form + TIMING.morph;

export const LINE_NAME = 'sig-line';
export const TITLE_NAME = 'sig-title';

export interface Signature {
  id: SignatureId;
  /** Selector, on the incoming page, of the element the line resolves into. */
  target: string;
  /** False when the source lacks the real data the signature shows; the navigation is then a plain one. */
  ready?(source: HTMLElement): boolean;
  /** Outgoing phase: mount the named overlay, resolve once it has formed. Returns a cleanup. */
  form(source: HTMLElement): Promise<() => void>;
}

const waveform: Signature = {
  id: 'waveform',
  target: '[data-sig-target]',
  async form(source) {
    // The record's pipeline line: hidden at rest on desktop, so fall back to a strip under the record.
    const pipe = source.querySelector<HTMLElement>('.pipe');
    const r = (pipe ?? source).getBoundingClientRect();
    const w = Math.max(160, r.width), h = 32;
    const top = pipe && r.height > 2 ? r.top + r.height / 2 - h / 2 : r.bottom - h;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    Object.assign(svg.style, { position: 'fixed', left: `${r.left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`, pointerEvents: 'none', viewTransitionName: LINE_NAME });
    const g = document.createElementNS(ns, 'g');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', waveformPath(w, h));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--c-system)');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    g.style.transformOrigin = 'center';
    g.append(path);
    svg.append(g);
    document.body.append(svg);

    // The pipeline text gives way to the signal; amplitude grows from a flat line (transform + opacity only).
    const anims = [
      g.animate([{ transform: 'scaleY(0.02)' }, { transform: 'scaleY(1)' }], { duration: TIMING.form, easing: EASE.out, fill: 'both' }),
      ...(pipe ? [pipe.animate([{ opacity: pipe.style.opacity || '1' }, { opacity: 0 }], { duration: TIMING.form / 2, fill: 'both' })] : []),
    ];
    await Promise.all(anims.map((a) => a.finished.catch(() => {})));
    return () => { anims.forEach((a) => a.cancel()); svg.remove(); };
  },
};

/**
 * MalTrace: the sample's SHA-256 (from the case study's `sample.sha256`, never made up) forms over the record and
 * settles into the same line under the case-study title. Opacity only, once, inside the same 460 ms budget.
 */
const hash: Signature = {
  id: 'hash',
  target: '[data-sig-hash-target]',
  ready: (source) => isSha256(source.dataset.sigHash),
  async form(source) {
    const title = source.querySelector<HTMLElement>('[data-sig-title]') ?? source;
    const r = title.getBoundingClientRect();
    const el = document.createElement('span');
    el.className = 'mono sig-hash';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = hashLabel(source.dataset.sigHash!);
    Object.assign(el.style, { position: 'fixed', left: `${r.left}px`, top: `${r.bottom}px`, pointerEvents: 'none', color: 'var(--c-info)', viewTransitionName: LINE_NAME });
    document.body.append(el);
    const a = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: TIMING.form, easing: EASE.out, fill: 'both' });
    await a.finished.catch(() => {});
    return () => { a.cancel(); el.remove(); };
  },
};

const SIGNATURES: Partial<Record<SignatureId, Signature>> = { waveform, hash };

export function signatureFor(id: string | undefined): Signature | null {
  return (id && SIGNATURES[id as SignatureId]) || null;
}
