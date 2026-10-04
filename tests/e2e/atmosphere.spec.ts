import { test, expect } from '@playwright/test';
import { instrument, live } from './helpers';

const barClip = (page: import('@playwright/test').Page, sel: string) =>
  page.evaluate((s) => getComputedStyle(document.querySelector(s)!, '::after').clipPath, sel);

test('redaction: bar covers until the element is seen, then wipes away; text is always in the HTML', async ({ page }) => {
  await instrument(page);
  await page.addInitScript(() => { Object.defineProperty(window, 'IntersectionObserver', { value: class { constructor(public cb: any) {} observe() {} disconnect() {} } }); });
  await page.goto('/');
  // with observation stubbed out nothing is revealed: the bar is armed and covering
  await page.waitForTimeout(300);
  expect(await barClip(page, '.claim')).toMatch(/inset\(0(px)?( 0(px)?){0,3}\)|inset\(0px\)/);
  await expect(page.locator('.claim')).toContainText("Building systems where probabilistic models don't control deterministic truth.");
});

test('redaction un-redacts on view', async ({ page }) => {
  await instrument(page);
  await page.goto('/');
  await expect(page.locator('.claim')).toHaveClass(/is-revealed/);
  await page.waitForTimeout(600);
  expect(await barClip(page, '.claim')).toMatch(/100%/);
});

test('failsafe: if the effects script never reports ready, the bars disarm after 4 s', async ({ page }) => {
  await instrument(page);
  await page.route('**/_astro/Atmosphere*.js', (r) => r.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-fx', 'failed', { timeout: 6000 });
  expect(await barClip(page, '.claim')).toMatch(/100%/);
});

test('reduced motion: no bars, no grain, no HUD, no decrypt, text intact', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForTimeout(800);
  await expect(page.locator('html')).not.toHaveAttribute('data-fx', /.+/);
  expect(await barClip(page, '.claim')).toMatch(/100%/);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.hero')!, '::before').content)).toBe('none');
  await expect(page.locator('[data-hud]')).toBeHidden();
  await expect(page.locator('h1')).not.toHaveAttribute('aria-label', /.+/);
  await expect(page.locator('h1')).toHaveText(/Vishva\s*Teja/);
  await ctx.close();
});

test('decrypt: H1 keeps an accessible name while it resolves, then returns to plain text', async ({ page }) => {
  await instrument(page);
  await page.addInitScript(() => {
    const names: string[] = [];
    (window as any).__names = names;
    new MutationObserver(() => { const l = document.querySelector('h1')?.getAttribute('aria-label'); if (l) names.push(l); })
      .observe(document, { subtree: true, attributes: true, attributeFilter: ['aria-label'] });
  });
  await page.goto('/');
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => (window as any).__names[0])).toBe('Vishva Teja');
  await expect(page.locator('h1')).not.toHaveAttribute('aria-label', /.+/);
  expect((await page.locator('h1').innerHTML()).replace(/ data-astro-cid-[\w-]+=""/g, '')).toBe('Vishva<br>Teja');
});

test('HUD shows the real route and a live clock only while the hero is awake', async ({ page }) => {
  await instrument(page);
  await page.goto('/');
  await live(page);
  await expect(page.locator('[data-hud-prompt]')).toHaveText('vishva@system:~$');
  await expect(page.locator('[data-hud-time]')).toHaveText(/^\d\d:\d\d:\d\d:\d\d$/);
  await page.mouse.move(321, 123);
  await expect(page.locator('[data-hud-xy]')).toHaveText(/X 0321\s+Y 0123/);
  await page.waitForTimeout(7500);
  const frozen = await page.locator('[data-hud-time]').textContent();
  await page.waitForTimeout(1000);
  expect(await page.locator('[data-hud-time]').textContent()).toBe(frozen); // asleep: no writes
});

test('glitch and transitions: nothing glitches on the homepage at idle', async ({ page }) => {
  await instrument(page);
  await page.goto('/');
  await live(page);
  await page.waitForTimeout(1000);
  await expect(page.locator('html')).not.toHaveAttribute('data-sig', /.+/);
  expect(await page.locator('.is-glitching').count()).toBe(0);
});

test('console: one greeting with the link, nothing else hidden', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(m.text()));
  await instrument(page);
  await page.goto('/');
  await page.waitForTimeout(500);
  const g = logs.filter((l) => l.includes("you're reading the source. good."));
  expect(g).toHaveLength(1);
  expect(g[0]).toContain('github.com/ckvishwa');
});

test('grain: static, 3.5%, hero and case header only, not a fixed layer; none on tier B', async ({ page, browser }) => {
  await instrument(page);
  await page.goto('/');
  const g = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.hero')!, '::before'); return { op: s.opacity, blend: s.mixBlendMode, anim: s.animationName, pos: s.position }; });
  expect(g).toEqual({ op: '0.035', blend: 'overlay', anim: 'none', pos: 'absolute' });
  expect(await page.evaluate(() => getComputedStyle(document.body, '::after').content)).toBe('none'); // no full-screen layer
  await page.goto('/work/rexi/');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.case-head')!, '::before').opacity)).toBe('0.035');

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await ctx.newPage();
  await phone.addInitScript(() => { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 6 }); });
  await phone.goto('/');
  await expect(phone.locator('html')).toHaveAttribute('data-tier', 'B');
  expect(await phone.evaluate(() => getComputedStyle(document.querySelector('.hero')!, '::before').content)).toBe('none');
  await ctx.close();
});

test('case study: labels drift slower than body text but never leave the viewport band', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/rexi/');
  await page.waitForTimeout(500);
  await page.evaluate(() => scrollTo(0, 400));
  await page.waitForTimeout(800);
  const y = await page.evaluate(() => {
    const m = getComputedStyle(document.querySelector('[data-scroll-depth]')!).transform;
    return m === 'none' ? 0 : new DOMMatrix(m).m42;
  });
  expect(Math.abs(y)).toBeLessThanOrEqual(0.15 * 720 + 1);
});
