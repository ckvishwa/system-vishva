import { test } from '@playwright/test';
import { instrument } from './helpers';
import { holdRange, rawForP, storyProgress } from '../../src/engine/motion/story-map';

// TEMPORARY diagnostic for the WebKit ghost: replays the screenshot walk and reports what is drawn at the EXPLODE dwell centre.
const W = 1 / 9;
test('ghost diagnostic', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await instrument(page);
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as any).getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) { const c = (get as any).call(this, type, ...rest); return c ?? (type === 'webgl2' ? ({} as any) : c); };
  });
  await page.goto('/work/maltrace/');
  await page.locator('.td-stage').waitFor();
  await page.waitForTimeout(800);
  const walk: [string, number][] = [['xray', rawForP(1.9 * W, false)], ['explode', rawForP(2.9 * W, false)], ['detonate', rawForP(3.6 * W, false)], ...['xray', 'explode'].map((n) => { const [a, b] = holdRange(n, false); return [`dwell-${n}`, (a + b) / 2] as [string, number]; })];
  for (const [name, r] of walk) {
    await page.evaluate((r) => { const t = document.querySelector('.td-track')!; scrollTo(0, t.getBoundingClientRect().top + scrollY + r * (t.clientHeight - innerHeight)); }, r);
    await page.waitForFunction((r) => Math.abs(+(document.querySelector('.td-stage') as HTMLElement).dataset.r! - r) < 0.002, r, { timeout: 8000 });
    await page.waitForTimeout(250);
    const info = await page.evaluate(() => {
      const total = document.querySelector('.td-total') as HTMLElement;
      const dr = +(document.querySelector('.td-stage') as HTMLElement).dataset.r!;
      const faint = [...document.querySelectorAll<HTMLElement>('.td-stage *')].filter((e) => e.children.length === 0 && (e.textContent ?? '').trim() && +getComputedStyle(e).opacity < 0.2 && +getComputedStyle(e).opacity > 0).map((e) => `${e.className}:${getComputedStyle(e).opacity}:${e.textContent!.slice(0, 20)}`);
      return { dr, total: total.textContent, inline: total.style.opacity, computed: getComputedStyle(total).opacity, vis: getComputedStyle(total).visibility, parentOp: getComputedStyle(total.parentElement!).opacity, faint };
    });
    const sp = storyProgress(info.dr, false);
    console.log(`GHOSTDIAG ${browserName} ${name} target=${r.toFixed(4)} drawn=${info.dr} p/W=${(sp / W).toFixed(4)} total="${info.total}" inline=${info.inline} computed=${info.computed} vis=${info.vis} parentOp=${info.parentOp} faint=${JSON.stringify(info.faint)}`);
  }
});
