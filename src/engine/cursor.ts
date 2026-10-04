/** Context cursor: '+' default, 'OPEN', 'INSPECT', 'RUN' via [data-cursor]. Tier A + fine pointer only (L-09). Phase 3. */
export function initCursor(): () => void {
  if (document.documentElement.dataset.tier !== 'A' || !matchMedia('(pointer: fine)').matches) return () => {};
  return () => {};
}
