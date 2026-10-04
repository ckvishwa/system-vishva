import { test, expect } from '@playwright/test';
import { instrument, live } from './helpers';

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

test('record -> case study runs the waveform transition and leaves nothing behind', async ({ page }) => {
  await instrument(page);
  await page.goto('/');
  await live(page);
  const started = await page.evaluate(() => {
    const w = window as any;
    w.__vt = 0;
    const orig = document.startViewTransition.bind(document);
    document.startViewTransition = (...a: any[]) => { w.__vt++; return (orig as any)(...a); };
    return typeof orig === 'function';
  });
  expect(started).toBe(true);
  const t0 = Date.now();
  await page.locator('a.record[href="/work/rexi/"]').click();
  await expect(page).toHaveURL(/\/work\/rexi\/$/);
  await expect(page.locator('html')).not.toHaveAttribute('data-sig', /.+/, { timeout: 3000 });
  expect(Date.now() - t0).toBeLessThan(1500);
  expect(await page.evaluate(() => (window as any).__vt)).toBeGreaterThan(0);
  await expect(page.locator('svg[style*="sig-line"]')).toHaveCount(0);
  await expect(page.locator('.is-glitching')).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Rexi');
});

test('reduced motion: navigation is an instant swap with no overlay', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.locator('a.record[href="/work/rexi/"]').click();
  await expect(page).toHaveURL(/\/work\/rexi\/$/);
  await expect(page.locator('html')).not.toHaveAttribute('data-sig', /.+/);
  await expect(page.locator('svg[style*="sig-line"]')).toHaveCount(0);
  await ctx.close();
});

test('rexi scroll story lights the pipeline in order, and back again', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/rexi/');
  const state = () => page.evaluate(() => [...document.querySelectorAll('[data-node]')].map((n) => (n.classList.contains('is-active') ? '1' : '0')).join(''));
  await page.waitForTimeout(500);
  expect(await state()).toMatch(/^1?0+$/); // at the top at most the first node is on
  const lit = async () => (await state()).split('1').length - 1;
  let prev = 0;
  for (const y of [300, 500, 700, 900]) {
    await page.evaluate((top) => scrollTo(0, top), y);
    await page.waitForTimeout(400);
    const s = await state();
    expect(s, `y=${y}`).toMatch(/^1*0*$/); // always a contiguous prefix: never out of order
    const n = await lit();
    expect(n).toBeGreaterThanOrEqual(prev);
    prev = n;
  }
  await page.evaluate(() => scrollTo(0, 1500));
  await expect.poll(state).toBe('11111111');
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(state).toMatch(/^1?0+$/);
});

test('rexi story: reduced motion shows the final state, with all content in the HTML', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/work/rexi/');
  await page.waitForTimeout(800);
  const nodes = await page.evaluate(() => [...document.querySelectorAll('[data-node]')].map((n) => getComputedStyle(n).opacity));
  expect(nodes).toHaveLength(8);
  nodes.forEach((o) => expect(o).toBe('1'));
  const traces = await page.evaluate(() => [...document.querySelectorAll('[data-trace]')].map((n) => getComputedStyle(n).strokeDashoffset));
  traces.forEach((o) => expect(parseFloat(o)).toBe(0));
  await expect(page.getByText('LLMs are good at language.')).toBeVisible();
  await expect(page.getByText('323+')).toBeVisible();
  await ctx.close();
});

test('rexi metrics count up and land on the exact text already in the HTML', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/rexi/');
  const before = await page.locator('[data-count]').allTextContents();
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  expect(await page.locator('[data-count]').allTextContents()).toEqual(before);
  expect(before).toEqual(['323+', '50/50', '71']);
});

test('iOS-style gyro: "Enable depth" is labelled, keyboard reachable, and asks permission from the tap', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 6 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });
    (window as any).__perm = 0;
    (window as any).DeviceOrientationEvent = Object.assign(function () {}, {
      requestPermission: async () => { (window as any).__perm++; return 'granted'; },
    });
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'B');
  const chip = page.getByRole('button', { name: 'Enable depth' });
  await expect(chip).toBeVisible();
  expect(await page.evaluate(() => (window as any).__perm)).toBe(0); // never prompts before a gesture
  await chip.focus();
  await expect(chip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).__perm)).toBe(1);
  await expect(chip).toBeHidden();
  await ctx.close();
});

test('case study idles at 0 frames, before and after scrolling and resizing (GSAP must not keep a loop alive)', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/rexi/');
  const idleFrames = async () => {
    await page.waitForTimeout(2200);
    await page.evaluate(() => { (window as any).__frames = 0; });
    await page.waitForTimeout(1500);
    return page.evaluate(() => (window as any).__frames);
  };
  expect(await idleFrames()).toBe(0);
  for (const y of [300, 700, 1100, 400]) { await page.evaluate((top) => scrollTo(0, top), y); await page.waitForTimeout(200); }
  expect(await idleFrames()).toBe(0);
  await page.setViewportSize({ width: 900, height: 700 });
  expect(await idleFrames()).toBe(0);
});
