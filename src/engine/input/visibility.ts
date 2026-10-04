/** Calls back with true/false as an element enters/leaves the viewport. */
export function onVisible(el: Element, cb: (visible: boolean) => void, rootMargin = '0px'): () => void {
  const io = new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}
