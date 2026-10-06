import { test, expect } from '@playwright/test';

/** Force tier A like the other tests (a 4-core CI runner is tier C and has no stage), without the site's frame counter. */
const tierA = () => {
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
};

/**
 * Smoothness. Scrolls the stage with real wheel events (steady, then a trackpad-style burst) while recording rAF deltas and
 * long tasks in the page. Any long task over 50 ms fails the test. The p95 frame time is reported, not asserted: CI hardware
 * varies, and the soft target is under 18 ms. (This test installs its own rAF probe, so it does not use the site's frame counter.)
 */
test('scrolling the teardown has no long task, and reports p95 frame time', async ({ page }, testInfo) => {
  await page.addInitScript(tierA);
  await page.addInitScript(() => {
    const w = window as any;
    w.__long = [] as number[];
    w.__deltas = [] as number[];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__long.push(e.duration))).observe({ entryTypes: ['longtask'] }); } catch { /* not supported */ }
    w.__probe = (on: boolean) => {
      if (!on) { w.__run = false; return; }
      w.__run = true;
      let last = 0;
      const f = (t: number) => { if (last) w.__deltas.push(t - last); last = t; if (w.__run) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    };
  });
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toBeVisible();
  await page.waitForTimeout(1500);

  // go to the top of the stage, then scroll through it
  await page.evaluate(() => { const t = document.querySelector('.td-track')!; scrollTo(0, t.getBoundingClientRect().top + scrollY - 56); });
  await page.waitForTimeout(500);
  await page.mouse.move(640, 400);
  await page.evaluate(() => { (window as any).__long.length = 0; (window as any).__deltas.length = 0; (window as any).__probe(true); });

  for (let i = 0; i < 70; i++) { await page.mouse.wheel(0, 70); await page.waitForTimeout(25); }           // steady wheel
  for (let i = 0; i < 25; i++) { await page.mouse.wheel(0, 140); }                                           // burst, no pause
  await page.waitForTimeout(900);
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, -90); await page.waitForTimeout(20); }           // and back
  await page.waitForTimeout(900);

  const { long, deltas } = await page.evaluate(() => { (window as any).__probe(false); return { long: (window as any).__long as number[], deltas: (window as any).__deltas as number[] }; });
  const sorted = [...deltas].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const msg = `teardown scroll: ${deltas.length} frames, p95 frame time ${p95.toFixed(1)} ms (soft target < 18 ms), long tasks ${long.length}${long.length ? ` (${long.map((d) => d.toFixed(0)).join(', ')} ms)` : ''}`;
  console.log(msg);
  testInfo.annotations.push({ type: 'perf', description: msg });
  expect(deltas.length, 'the probe saw frames').toBeGreaterThan(20);
  expect(long.filter((d) => d > 50), msg).toEqual([]);
});

test('the displayed progress lands exactly on the scroll position and then no frame is drawn', async ({ page }) => {
  await page.addInitScript(tierA);
  await page.addInitScript(() => {
    const w = window as any; w.__f = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { w.__f++; cb(t); });
  });
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const t = document.querySelector('.td-track')!; scrollTo(0, t.getBoundingClientRect().top + scrollY + 0.5 * (t.clientHeight - innerHeight)); });
  await page.waitForFunction(() => Math.abs(+(document.querySelector('.td-stage') as HTMLElement).dataset.r! - 0.5) < 0.0006, null, { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => { (window as any).__f = 0; });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).__f)).toBe(0); // the spring slept
});

test('a wheel burst glides: progress moves toward the target over several frames, not in one jump', async ({ page }) => {
  await page.addInitScript(tierA);
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toBeVisible();
  await page.evaluate(() => { const t = document.querySelector('.td-track')!; scrollTo(0, t.getBoundingClientRect().top + scrollY - 56); });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const w = window as any; w.__p = [] as number[];
    const s = document.querySelector('.td-stage') as HTMLElement;
    new MutationObserver(() => w.__p.push(+s.dataset.r!)).observe(s, { attributes: true, attributeFilter: ['data-r'] });
    scrollBy(0, 900); // one instant jump in scroll position
  });
  await page.waitForTimeout(1500);
  const ps = await page.evaluate(() => (window as any).__p as number[]);
  expect(ps.length).toBeGreaterThan(8);                 // many frames, not one
  for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeGreaterThanOrEqual(ps[i - 1] - 1e-9); // only ever forward: no overshoot
  const biggest = Math.max(...ps.map((p, i) => (i ? p - ps[i - 1] : p - 0)));
  expect(biggest).toBeLessThan((ps[ps.length - 1] - ps[0]) * 0.5); // no single frame covers half the distance
});
