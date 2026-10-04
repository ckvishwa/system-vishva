/**
 * Page-transition signatures (ARD §7 idea 4). A signature turns a source on the outgoing page
 * into a named view-transition element ("sig-line") that morphs into a target on the incoming
 * page. The glitch (E5) is a phase of every signature, not a separate effect: the outgoing title
 * is renamed "sig-title" so transitions.css can play its 3-frame slice offset inside the window.
 *
 * MalTrace ("hash") plugs in by adding an entry to SIGNATURES; unknown signatures navigate normally.
 */
import { waveformPath } from './waveform';
import { EASE } from '../motion/tokens';

export type SignatureId = 'waveform' | 'hash' | 'stream' | 'stamp';

/** Phase budget in ms. transitions.css repeats `morph`; a test keeps them in sync. Total stays under 700. */
export const TIMING = { form: 180, morph: 280, resolve: 200 } as const;
export const TOTAL_MS = TIMING.form + TIMING.morph + TIMING.resolve;

export const LINE_NAME = 'sig-line';
export const TITLE_NAME = 'sig-title';

export interface Signature {
  id: SignatureId;
  /** Selector, on the incoming page, of the element the line resolves into. */
  target: string;
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

const SIGNATURES: Partial<Record<SignatureId, Signature>> = { waveform };

export function signatureFor(id: string | undefined): Signature | null {
  return (id && SIGNATURES[id as SignatureId]) || null;
}
