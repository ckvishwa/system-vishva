/**
 * Redaction reveal (meaning: state, evidence surfacing). Key phrases start under a solid bar and are
 * un-redacted when they scroll into view. The text is in the HTML from the start; the bar is a
 * pseudo-element (see [data-fx~=redact] in fx.css), so screen readers and no-JS users read it normally.
 * This module only flips a class: the stepped wipe itself is a CSS transition.
 */
import { onceVisible } from '../input/visibility';

export function initRedact(root: ParentNode = document): () => void {
  const offs: Array<() => void> = [];
  root.querySelectorAll<HTMLElement>('[data-fx~="redact"]').forEach((el) => {
    offs.push(onceVisible(el, () => el.classList.add('is-revealed'), '0px 0px -10% 0px'));
  });
  return () => offs.forEach((f) => f());
}
