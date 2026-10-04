/**
 * Case-study depth (meaning: hierarchy). Small section labels ([data-scroll-depth]) drift slower than the
 * body text as you scroll, so structure reads as depth. translateY only, at most 15% of the viewport,
 * eased with the shared lerp from fx/parallax. Sleeps whenever nothing is scrolling.
 */
import { scheduler } from '../scheduler';
import { trackScroll } from '../input/scroll';
import { easeToward, MAX_SCROLL_FRACTION } from './parallax';

/** Target translateY (px) for an element whose natural centre is `d` (-1..1) from the viewport centre. */
export const depthShift = (d: number, depth: number, vh: number) =>
  -Math.max(-1, Math.min(1, d)) * MAX_SCROLL_FRACTION * vh * (1 - depth);

export function mountScrollDepth(root: ParentNode = document): () => void {
  const items = [...root.querySelectorAll<HTMLElement>('[data-scroll-depth]')].map((el) => ({ el, depth: Number(el.dataset.scrollDepth) || 0.5, y: 0 }));
  if (!items.length) return () => {};
  const sched = scheduler();

  sched.add('depth', (dt) => {
    const vh = innerHeight;
    let moving = false;
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      const natural = r.top + r.height / 2 - it.y; // where it would be without our own offset
      const target = depthShift((natural - vh / 2) / (vh / 2), it.depth, vh);
      it.y = easeToward(it.y, target, dt);
      if (Math.abs(target - it.y) > 0.05) moving = true; else it.y = target;
      it.el.style.transform = `translate3d(0, ${it.y.toFixed(2)}px, 0)`;
    }
    return moving;
  });
  const off = trackScroll(() => sched.invalidate('depth'));

  return () => { off(); sched.remove('depth'); items.forEach((it) => { it.el.style.transform = ''; }); };
}
