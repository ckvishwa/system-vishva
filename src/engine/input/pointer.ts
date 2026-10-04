/** Normalised pointer position (-1..1), fine pointers only (ARD L-09). */
export function trackPointer(onMove: (x: number, y: number) => void): () => void {
  if (!matchMedia('(pointer: fine)').matches) return () => {};
  const h = (e: PointerEvent) => onMove((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  addEventListener('pointermove', h, { passive: true });
  return () => removeEventListener('pointermove', h);
}
