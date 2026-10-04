/** Mirrors styles/motion.css so CSS and JS share one clock (ARD §4). */
export const DURATION = { d1: 120, d2: 240, d3: 480, d4: 900 } as const;
export const EASE = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  inout: 'cubic-bezier(0.65, 0, 0.35, 1)',
  step: 'steps(8, end)',
} as const;
/** Plan 1 §14: every animation must communicate one of these. Tag animations with it. */
export type MotionIntent = 'flow' | 'state' | 'dependency' | 'cause' | 'hierarchy' | 'change';
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.tier === 'C';
