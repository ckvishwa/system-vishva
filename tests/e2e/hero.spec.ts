import { test, expect, type Page } from '@playwright/test';

/**
 * Test-only instrumentation, injected before any page script runs:
 *  - __frames: every requestAnimationFrame callback that actually ran (the scheduler is the only caller)
 *  - __gl: WebGL contexts created for #system-environment, and how many were lost since
 * Also forces tier A so the scene mounts regardless of the CI machine's core count.
 */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    const w = window as any;
    w.__frames = 0;
    w.__gl = { created: 0, lost: 0 };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { w.__frames++; cb(t); });
    const seen = new WeakSet<HTMLCanvasElement>();
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: any[]) {
      const ctx = (getContext as any).call(this, type, ...rest);
      if (ctx && type.startsWith('webgl') && this.id === 'system-environment' && !seen.has(this)) {
        seen.add(this);
        w.__gl.created++;
        this.addEventListener('webglcontextlost', () => { w.__gl.lost++; });
      }
      return ctx;
    } as typeof getContext;
  });
}

const live = (page: Page) => expect(page.locator('html')).toHaveAttribute('data-scene', 'live', { timeout: 15_000 });

test('homepage renders 0 animation frames after the 6 s drift window, with no input', async ({ page }) => {
  await instrument(page);
  await page.goto('/');
  await live(page);
  await page.waitForTimeout(7500); // 6 s drift + settle
  await page.evaluate(() => { (window as any).__frames = 0; });
  await page.waitForTimeout(2000);
  expect(await page.evaluate(() => (window as any).__frames)).toBe(0);
});

test('home <-> /work/rexi/ x10 leaves at most one live WebGL context', async ({ page }) => {
  await instrument(page);
  await page.goto('/');
  await live(page);
  for (let i = 0; i < 10; i++) {
    await page.locator('a.record[href="/work/rexi/"]').click();
    await expect(page).toHaveURL(/\/work\/rexi\/$/);
    await page.locator('a.mark').click();
    await expect(page).toHaveURL(/\/$/);
    await live(page);
  }
  await expect.poll(() => page.evaluate(() => { const g = (window as any).__gl; return g.created - g.lost; })).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => (window as any).__gl.created)).toBeGreaterThan(1); // it really did remount
});

test('reduced motion: no canvas in the DOM', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForTimeout(1500);
  await expect(page.locator('canvas')).toHaveCount(0);
  await ctx.close();
});
