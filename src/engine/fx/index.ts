/**
 * Atmosphere layer entry point (ADR-0012). Called on every astro:page-load; returns a cleanup for astro:before-swap.
 * Everything here is armed only for tiers A/B: <html data-fx="armed"> is set by the pre-paint boot script.
 * The hero's HUD and parallax live in scene/hero.ts so they share the hero's scheduler subscription.
 */
import { initRedact } from './redact';
import { initDecrypt } from './decrypt';
import { mountScrollDepth } from './depth';
import { sourceGreeting } from './console';

let greeted = false;

export function mountFx(): () => void {
  const html = document.documentElement;
  if (html.dataset.fx !== 'armed') return () => {};
  html.dataset.fxReady = '1'; // tells the boot script's 4 s failsafe that the effects are alive
  if (!greeted) { greeted = true; sourceGreeting(); }
  const offs = [initRedact(), initDecrypt(), mountScrollDepth()];
  return () => offs.forEach((f) => f());
}
