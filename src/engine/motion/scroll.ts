/**
 * ARD D-04 — GSAP + ScrollTrigger, lazy-loaded on case-study pages only.
 * Phase 1: implement storyboard beats from docs/storyboards/<slug>.md.
 */
export async function initScrollStory(root: HTMLElement): Promise<() => void> {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  const steps = root.querySelectorAll<HTMLElement>('[data-step]');
  steps.forEach((step) => {
    ScrollTrigger.create({
      trigger: step,
      start: 'top 65%',
      onEnter: () => step.classList.add('is-active'),
      onLeaveBack: () => step.classList.remove('is-active'),
    });
  });
  return () => ScrollTrigger.getAll().forEach((t) => t.kill()); // ARD §5 cleanup rule
}
