import { DURATION, reducedMotion } from './tokens';
import { scheduler } from '../scheduler';
/** Metric count-up ≤ 800 ms through the shared scheduler (ARD §5). Final value is already in the HTML. */
export function countUp(el: HTMLElement): void {
  const target = Number(el.dataset.value);
  if (!Number.isFinite(target) || reducedMotion()) return;
  const fmt = new Intl.NumberFormat('en-US');
  const dur = Math.min(DURATION.d4, 800);
  let t = 0;
  const id = `count-${Math.random().toString(36).slice(2)}`;
  scheduler().add(id, (dt) => {
    t = Math.min(dur, t + dt);
    const p = 1 - Math.pow(1 - t / dur, 3);
    el.textContent = fmt.format(Math.round(target * p)) + (el.dataset.suffix ?? '');
    if (t >= dur) { scheduler().remove(id); return false; }
    return true;
  });
}
