/**
 * Hero controller: wires the static SVG layers, the WebGL scene and the inputs to ONE scheduler
 * subscription ("hero"). Everything it starts is released by the function it returns, which the
 * island calls on astro:before-swap.
 */
import { scheduler } from '../scheduler';
import { TIER_CONFIG, type Tier } from '../tier';
import { trackPointer } from '../input/pointer';
import { trackGyro, needsPermission, requestGyro } from '../input/gyro';
import { trackScroll } from '../input/scroll';
import { onVisible } from '../input/visibility';
import { createParallax, DEPTH } from '../fx/parallax';
import { createHud } from '../fx/hud';
import type { GraphData } from './graph';
import type { SceneHandle } from './SystemScene';

const ID = 'hero';

export function mountHero(root: HTMLElement, tier: Tier): () => void {
  const cfg = TIER_CONFIG[tier];
  if (!cfg.render) return () => {};

  const hero = root.closest<HTMLElement>('.hero') ?? root;
  const plot = root.querySelector<HTMLElement>('.plot');
  const chip = document.querySelector<HTMLButtonElement>('[data-depth-chip]');
  if (!plot) return () => {};

  // The canvas only exists for tiers that render (reduced motion / tier C never get one in the DOM).
  const canvas = document.createElement('canvas');
  canvas.id = 'system-environment';
  canvas.hidden = true;
  plot.append(canvas);

  const sched = scheduler();
  const offs: Array<() => void> = [];
  let scene: SceneHandle | null = null;
  let visible = true;
  let live = false;
  let disposed = false;

  const layers = [...root.querySelectorAll<HTMLElement>('[data-depth]')].map((el) => ({ el, depth: Number(el.dataset.depth) || DEPTH.graph }));
  const parallax = createParallax(layers);
  const hudEl = root.querySelector<HTMLElement>('[data-hud]');
  const hud = hudEl ? createHud(hudEl) : null;
  const wake = () => { if (visible) sched.invalidate(ID); };
  const scrollProgress = () => Math.min(1, scrollY / Math.max(1, hero.offsetHeight));

  sched.add(ID, (dt, now) => {
    if (!visible || disposed) return false;
    const a = scene ? scene.frame(dt) : false;
    const b = parallax.step(dt);
    hud?.tick(now);
    if (scene && !live) {
      live = true;
      canvas.hidden = false;
      root.classList.add('is-live');
      document.documentElement.dataset.scene = 'live';
    }
    return a || b;
  });

  offs.push(trackPointer((x, y) => {
    parallax.setPointer(x, y);
    scene?.setPointer(x, y);
    hud?.setPointer(Math.round(((x + 1) / 2) * innerWidth), Math.round(((y + 1) / 2) * innerHeight));
    wake();
  }));
  offs.push(trackScroll(() => { parallax.setScroll(scrollProgress()); scene?.boundsChanged(); wake(); }));
  offs.push(onVisible(hero, (v) => { visible = v; if (v) wake(); }));

  const ro = new ResizeObserver(() => { scene?.resize(plot.clientWidth, plot.clientHeight); parallax.resize(innerHeight); wake(); });
  ro.observe(plot);
  offs.push(() => ro.disconnect());

  if (cfg.gyro) {
    const start = () => offs.push(trackGyro((x, y) => { parallax.setTilt(x, y); wake(); }));
    if (needsPermission()) {
      if (chip) {
        chip.hidden = false;
        // iOS only: the permission prompt must come from this tap.
        const onTap = async () => { chip.hidden = true; if (await requestGyro()) start(); };
        chip.addEventListener('click', onTap, { once: true });
        offs.push(() => { chip.removeEventListener('click', onTap); chip.hidden = true; });
      }
    } else start();
  }

  // Three.js loads after first paint, never before (ARD L-03).
  const load = () => {
    const idle = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 600 }) : setTimeout(cb, 200));
    idle(async () => {
      if (disposed) return;
      try {
        const { createSystemScene } = await import('./SystemScene');
        const data = JSON.parse(root.dataset.graph ?? '{}') as GraphData;
        const s = await createSystemScene(canvas, tier, data);
        if (disposed) { s.dispose(); return; }
        scene = s;
        s.resize(plot.clientWidth, plot.clientHeight);
        wake();
      } catch {
        /* the static SVG is the fallback, not an error */
      }
    });
  };
  if (document.readyState === 'complete') load();
  else addEventListener('load', load, { once: true });
  offs.push(() => removeEventListener('load', load));

  return () => {
    disposed = true;
    sched.remove(ID);
    offs.forEach((f) => f());
    parallax.dispose();
    scene?.dispose();
    scene = null;
    canvas.remove();
    delete document.documentElement.dataset.scene;
  };
}
