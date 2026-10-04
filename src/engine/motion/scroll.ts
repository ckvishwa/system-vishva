/**
 * ARD D-04 (superseded by ADR-0014): the scroll story runs on input/scroll.ts and the shared scheduler,
 * with no animation library. On each scroll or resize the story wakes the scheduler, which measures each beat
 * once (getBoundingClientRect), turns that into a 0..1 progress and toggles classes, then sleeps again.
 * An idle case study therefore renders 0 frames, exactly like every other page.
 *
 * Implements the pipeline beats of docs/storyboards/<slug>.md. It only toggles classes on markup that is already
 * in the page; it never creates or hides content.
 *   - pipeline groups ([data-nodes="1-3"]): nodes light in order, connectors draw as their node lights
 *   - metrics ([data-beat="state"]): count-up once, final value already in the HTML
 * Beat 4 (cause) is a hard cut and beat 5 awaits real captures, so neither is animated here.
 */
import { parseRange, pipelineState, sectionProgress, traceOn } from './story';
import { countUp } from './count';
import { scheduler } from '../scheduler';
import { trackScroll, trackViewport } from '../input/scroll';

const ID = 'story';
const METRICS_AT = 0.85; // count up once the metrics reach 85% of the viewport height

export function initScrollStory(root: HTMLElement): () => void {
  const nodes = [...root.querySelectorAll<SVGGElement>('[data-node]')];
  const traces = [...root.querySelectorAll<SVGPathElement>('[data-trace]')];
  const groups = [...root.querySelectorAll<HTMLElement>('[data-nodes]')].map((el) => ({
    el,
    range: parseRange(el.dataset.nodes!, nodes.length),
    progress: 0,
  }));
  const metrics = root.querySelector<HTMLElement>('[data-beat="state"]');
  let counted = false;

  const sched = scheduler();
  sched.add(ID, () => {
    const vh = innerHeight;
    for (const g of groups) {
      const r = g.el.getBoundingClientRect();
      g.progress = sectionProgress(r.top, r.height, vh);
    }
    const on = pipelineState(nodes.length, groups);
    nodes.forEach((n, i) => n.classList.toggle('is-active', on[i]));
    traces.forEach((t, j) => t.classList.toggle('is-drawn', traceOn(on, j)));

    if (metrics && !counted && metrics.getBoundingClientRect().top < vh * METRICS_AT) {
      counted = true;
      metrics.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
    }
    return false; // measured once; sleep until the next scroll or resize
  });

  const wake = () => sched.invalidate(ID);
  const offs = [trackScroll(wake), trackViewport(wake)];
  return () => { offs.forEach((f) => f()); sched.remove(ID); }; // ARD §5 cleanup rule
}
