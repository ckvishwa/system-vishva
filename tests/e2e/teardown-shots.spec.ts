import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { instrument } from './helpers';
import { holdRange, rawForP } from '../../src/engine/motion/story-map';

/**
 * Screenshots of the exploded view in Chromium and WebKit (project name = engine) at desktop and mobile sizes, for X-RAY,
 * EXPLODE and DETONATE. They are written to test-results/teardown-shots/ (CI uploads them as an artifact); run with
 * SHOTS_DIR=docs/teardown-shots to refresh the committed copies. The assertions are about the picture being a real one:
 * the stage is live, the sections are drawn, and nothing overflows sideways in either engine.
 */
const W = 1 / 9;
const SIZES = { '1280': { width: 1280, height: 800 }, '390': { width: 390, height: 800 } } as const;
// the moving frames (mapped progress), and the centre of each hero dwell
const MOVING = { xray: 1.9 * W, explode: 2.9 * W, detonate: 3.6 * W } as const;
const HOLDS = ['xray', 'explode', 'detonate', 'verdict', 'map'] as const;
const DIR = process.env.SHOTS_DIR ?? 'test-results/teardown-shots';

for (const [size, viewport] of Object.entries(SIZES)) {
  test(`teardown screenshots at ${size}`, async ({ page, browserName }) => {
    mkdirSync(DIR, { recursive: true });
    await page.setViewportSize(viewport);
    if (size === '390') await page.emulateMedia({ reducedMotion: 'no-preference' });
    await instrument(page);
    // A headless engine may have no WebGL2, which would put the page in tier C (no stage). The stage uses only a 2D canvas, so
    // let the tier check pass; the case study page never creates a WebGL context.
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      (HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) { const c = (get as any).call(this, type, ...rest); return c ?? (type === 'webgl2' ? ({} as any) : c); };
    });
    await page.goto('/work/maltrace/');
    await expect(page.locator('.td-stage'), `${browserName}: the stage is live (tier A)`).toBeVisible();
    await page.waitForTimeout(800);
    const shots: [string, number][] = [
      ...Object.entries(MOVING).map(([n, p]) => [n, rawForP(p, size === '390')] as [string, number]),
      ...HOLDS.map((n) => { const [a, b] = holdRange(n, size === '390'); return [`dwell-${n}`, (a + b) / 2] as [string, number]; }),
    ];
    for (const [name, r] of shots) {
      await page.evaluate((r) => { const t = document.querySelector('.td-track')!; scrollTo(0, t.getBoundingClientRect().top + scrollY + r * (t.clientHeight - innerHeight)); }, r);
      await page.waitForFunction((r) => Math.abs(+(document.querySelector('.td-stage') as HTMLElement).dataset.r! - r) < 0.0007, r, { timeout: 8000 });
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${browserName} ${size} ${name}: no horizontal overflow`).toBe(true);
      expect(await page.locator('.td-slab').count()).toBe(4);
      const box = await page.locator('.td-slab').first().boundingBox();
      expect(box!.width).toBeGreaterThan(50);
      await page.screenshot({ path: `${DIR}/${browserName}-${name}-${size}.png` });
    }
  });
}
