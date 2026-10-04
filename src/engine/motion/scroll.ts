/**
 * ARD D-04 — GSAP + ScrollTrigger, lazy-loaded on case-study pages only (by the ScrollStory island).
 * Implements the pipeline beats of docs/storyboards/<slug>.md. It only toggles classes on markup
 * that is already in the page; it never creates or hides content.
 *   - pipeline groups ([data-nodes="1-3"]): nodes light in order, connectors draw as their node lights
 *   - metrics ([data-beat="state"]): count-up once, final value already in the HTML
 * Beat 4 (cause) is a hard cut and beat 5 awaits real captures, so neither is animated here.
 */
import { parseRange, pipelineState, traceOn } from './story';
import { countUp } from './count';

export async function initScrollStory(root: HTMLElement): Promise<() => void> {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);

  const nodes = [...root.querySelectorAll<SVGGElement>('[data-node]')];
  const traces = [...root.querySelectorAll<SVGPathElement>('[data-trace]')];
  const groups = [...root.querySelectorAll<HTMLElement>('[data-nodes]')].map((el) => ({
    el,
    range: parseRange(el.dataset.nodes!, nodes.length),
    progress: 0,
  }));

  const render = () => {
    const on = pipelineState(nodes.length, groups);
    nodes.forEach((n, i) => n.classList.toggle('is-active', on[i]));
    traces.forEach((t, j) => t.classList.toggle('is-drawn', traceOn(on, j)));
  };

  const triggers: Array<{ kill: () => void }> = [];

  // ARD §5: one frame loop. Left alone, GSAP keeps an idle case study busy three ways: ScrollTrigger runs a
  // perpetual requestAnimationFrame loop (a repaint workaround), GSAP's ticker is a second one, and a 250 ms
  // setInterval polls sizes and schedules a frame each time. None is needed here: ScrollTrigger re-evaluates on
  // scroll and resize, and our callbacks only toggle classes. Starve all three while it initialises, then
  // restore the real functions so scroll-driven updates still run (those are finite: they stop with the scroll).
  // The e2e test "case study idles at 0 frames" fails if a GSAP upgrade brings any of them back.
  const realRaf = window.requestAnimationFrame;
  const realInterval = window.setInterval;
  window.requestAnimationFrame = () => 0;
  window.setInterval = (() => 0) as unknown as typeof window.setInterval;
  try {
    gsap.registerPlugin(ScrollTrigger);
    gsap.ticker.sleep();

    for (const g of groups) {
      triggers.push(ScrollTrigger.create({
        trigger: g.el,
        start: 'top 75%',
        end: 'bottom 45%',
        onUpdate: (self) => { g.progress = self.progress; render(); },
        onRefresh: (self) => { g.progress = self.progress; render(); },
      }));
    }

    const metrics = root.querySelector<HTMLElement>('[data-beat="state"]');
    if (metrics) {
      triggers.push(ScrollTrigger.create({
        trigger: metrics,
        start: 'top 85%',
        once: true,
        onEnter: () => metrics.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp),
      }));
    }
  } finally {
    window.requestAnimationFrame = realRaf;
    window.setInterval = realInterval;
  }

  render();
  return () => triggers.forEach((t) => t.kill()); // ARD §5 cleanup rule
}
