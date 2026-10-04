/** Window scroll position in px. The one shared scroll tracker (parallax, scene bounds, scroll story). */
export function trackScroll(onScroll: (y: number) => void): () => void {
  const h = () => onScroll(scrollY);
  addEventListener('scroll', h, { passive: true });
  return () => removeEventListener('scroll', h);
}

/** Viewport size changes (resize, rotation, mobile toolbar). Layout-dependent effects re-measure on this. */
export function trackViewport(onResize: () => void): () => void {
  addEventListener('resize', onResize, { passive: true });
  return () => removeEventListener('resize', onResize);
}
