/** Calls back with true/false as an element enters/leaves the viewport. */
export function onVisible(el: Element, cb: (visible: boolean) => void, rootMargin = '0px'): () => void {
  const io = new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

/** Calls back once, the first time the element is visible, then stops observing. */
export function onceVisible(el: Element, cb: () => void, rootMargin = '0px'): () => void {
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); cb(); } }, { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}
