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
  gsap.registerPlugin(ScrollTrigger);

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

  const triggers: Array<{ kill: () => void }> = groups.map((g) =>
    ScrollTrigger.create({
      trigger: g.el,
      start: 'top 75%',
      end: 'bottom 45%',
      onUpdate: (self) => { g.progress = self.progress; render(); },
      onRefresh: (self) => { g.progress = self.progress; render(); },
    }),
  );

  const metrics = root.querySelector<HTMLElement>('[data-beat="state"]');
  if (metrics) {
    triggers.push(ScrollTrigger.create({
      trigger: metrics,
      start: 'top 85%',
      once: true,
      onEnter: () => metrics.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp),
    }));
  }

  render();
  return () => triggers.forEach((t) => t.kill()); // ARD §5 cleanup rule
}
