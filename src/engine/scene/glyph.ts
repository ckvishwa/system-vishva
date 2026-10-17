/**
 * Hero layer B's interactivity. The SSR'd markup (components/ui/GlyphPortrait.astro) is already the
 * fully-resolved portrait — that is the no-JS and reduced-motion state. Here, once mounted, the grid
 * first goes to a deterministic noise texture (the JS-on resting state), then cells within RADIUS of
 * the pointer resolve back to their real glyph and decay to noise again once the pointer leaves.
 *
 * Lazy: dynamically imported from scene/hero.ts after idle, alongside the WebGL scene, so it never
 * touches pre-LCP JS. Only mounted for tiers that already run that scene (reduced motion always
 * decides tier C first, so this never runs under reduced motion). On a coarse pointer there is
 * nothing to track, so the whole grid resolves once, on first scroll, and stays resolved.
 */
import { scheduler } from '../scheduler';
import { trackPointer } from '../input/pointer';
import { trackScroll } from '../input/scroll';

const RADIUS = 90; // px
const DECAY_MS = 900;
const MAX_WRITES_PER_FRAME = 48; // caps a fast pointer sweep from stalling the main thread
const SPARSE = ' .,:;'; // the ramp's emptiest end: texture, never a second face

interface Cell { el: HTMLElement; ch: string; level: string; cx: number; cy: number; resolved: boolean; until: number }

/** Park–Miller LCG: tiny, deterministic, good enough for a visual texture. */
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function mountGlyph(root: HTMLElement, id = 'glyph'): () => void {
  const grid = root.querySelector<HTMLElement>('[data-glyph]');
  const rows = grid ? [...grid.querySelectorAll<HTMLElement>('.gl-row')] : [];
  if (!grid || !rows.length) return () => {};

  const cells: Cell[] = [];
  rows.forEach((row) => [...row.children].forEach((span) => {
    const el = span as HTMLElement;
    cells.push({ el, ch: el.textContent ?? '', level: el.className.slice(2), cx: 0, cy: 0, resolved: true, until: 0 });
  }));

  const rand = seeded(1);
  const noise = (c: Cell) => { c.el.textContent = SPARSE[Math.floor(rand() * SPARSE.length)]; c.el.className = 'gl1'; c.resolved = false; };
  const resolve = (c: Cell) => { c.el.textContent = c.ch; c.el.className = `gl${c.level}`; c.resolved = true; };

  cells.forEach(noise);

  if (!matchMedia('(pointer: fine)').matches) {
    const off = trackScroll(() => { cells.forEach(resolve); off(); }); // touch: resolve once and stop watching
    return off;
  }

  const measure = () => {
    const rect = grid.getBoundingClientRect();
    const cols = rows[0].children.length || 1;
    const cellW = rect.width / cols, cellH = rect.height / rows.length;
    let i = 0;
    rows.forEach((row, r) => [...row.children].forEach((_, c) => {
      cells[i].cx = rect.left + (c + 0.5) * cellW;
      cells[i].cy = rect.top + (r + 0.5) * cellH;
      i++;
    }));
  };
  measure();

  const sched = scheduler();
  let px = -9999, py = -9999;
  const offs: Array<() => void> = [
    trackPointer((x, y) => { px = ((x + 1) / 2) * innerWidth; py = ((y + 1) / 2) * innerHeight; sched.invalidate(id); }),
  ];
  const ro = new ResizeObserver(measure);
  ro.observe(grid);
  offs.push(() => ro.disconnect());

  sched.add(id, (_dt, now) => {
    let writes = 0;
    let active = false;
    for (const c of cells) {
      const near = Math.hypot(c.cx - px, c.cy - py) < RADIUS;
      if (near) {
        c.until = now + DECAY_MS;
        if (!c.resolved && writes < MAX_WRITES_PER_FRAME) { resolve(c); writes++; }
      } else if (c.resolved && now > c.until && writes < MAX_WRITES_PER_FRAME) {
        noise(c); writes++;
      }
      if (c.resolved) active = true;
    }
    return active; // sleeps once every resolved cell has decayed back to noise
  });

  return () => { sched.remove(id); offs.forEach((f) => f()); };
}
