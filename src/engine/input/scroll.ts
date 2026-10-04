/** Window scroll position in px. The one shared scroll tracker (parallax, scene bounds). */
export function trackScroll(onScroll: (y: number) => void): () => void {
  const h = () => onScroll(scrollY);
  addEventListener('scroll', h, { passive: true });
  return () => removeEventListener('scroll', h);
}
