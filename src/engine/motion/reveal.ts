import { onVisible } from '../input/visibility';
/** Adds .is-revealed once when a [data-reveal] element enters view. CSS does the animating. */
export function initReveals(root: ParentNode = document): () => void {
  const offs: Array<() => void> = [];
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    const off = onVisible(el, (v) => { if (v) { el.classList.add('is-revealed'); off(); } }, '0px 0px -10% 0px');
    offs.push(off);
  });
  return () => offs.forEach((f) => f());
}
