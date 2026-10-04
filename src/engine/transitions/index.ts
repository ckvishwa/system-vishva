/**
 * Wires signatures into Astro's ClientRouter lifecycle. One call, one cleanup.
 *  before-preparation: outgoing phase runs while the next page loads (the loader is wrapped).
 *  before-swap:        names the target and the incoming title on the new document.
 * Reduced motion / tier C: nothing is hooked, and motion.css makes the swap instant.
 */
import { reducedMotion } from '../motion/tokens';
import { signatureFor, LINE_NAME, TITLE_NAME } from './signatures';

const titleOf = (root: ParentNode) => root.querySelector<HTMLElement>('[data-sig-title]');

export function initTransitions(): () => void {
  if (reducedMotion() || !('startViewTransition' in document)) return () => {};

  const html = document.documentElement;
  let cleanup: (() => void) | null = null;
  let renamed: HTMLElement | null = null;

  const clear = () => {
    cleanup?.(); cleanup = null;
    if (renamed) { renamed.style.viewTransitionName = ''; renamed.classList.remove('is-glitching'); renamed = null; }
    delete html.dataset.sig;
  };

  const onPrep = (e: Event) => {
    const ev = e as Event & { sourceElement?: Element; loader: () => Promise<void>; direction: string };
    const source = ev.sourceElement?.closest<HTMLElement>('[data-sig]');
    const sig = signatureFor(source?.dataset.sig);
    if (!source || !sig || ev.direction !== 'forward') return;

    html.dataset.sig = sig.id;
    const title = titleOf(source);
    if (title) { title.style.viewTransitionName = TITLE_NAME; title.classList.add('is-glitching'); renamed = title; }

    const load = ev.loader;
    ev.loader = async () => {
      // Form the signal while the next page loads; never wait longer than the form phase for it.
      const [done] = await Promise.all([sig.form(source), load()]);
      cleanup = done;
    };
  };

  const onSwap = (e: Event) => {
    const ev = e as Event & { newDocument: Document; viewTransition?: ViewTransition };
    const sig = signatureFor(html.dataset.sig);
    if (!sig) return;
    // The router replaces <html> attributes with the new page's, so re-assert the signature for the CSS.
    ev.newDocument.documentElement.dataset.sig = sig.id;
    ev.newDocument.querySelector<HTMLElement>(sig.target)?.style.setProperty('view-transition-name', LINE_NAME);
    const t = titleOf(ev.newDocument);
    if (t) t.style.setProperty('view-transition-name', TITLE_NAME);
    ev.viewTransition?.finished.finally(clear);
  };

  document.addEventListener('astro:before-preparation', onPrep);
  document.addEventListener('astro:before-swap', onSwap);
  return () => {
    document.removeEventListener('astro:before-preparation', onPrep);
    document.removeEventListener('astro:before-swap', onSwap);
    clear();
  };
}
