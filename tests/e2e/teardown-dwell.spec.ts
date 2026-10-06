import { test, expect, type Page } from '@playwright/test';
import { instrument } from './helpers';
import { holdRange, rawForP, storyLength } from '../../src/engine/motion/story-map';

/**
 * Cinematic dwell: scroll distance where the picture stays fixed. The pacing lives in src/engine/motion/story-map.ts; these tests
 * drive the real page through it. A hold is not a timer: when the visitor stops scrolling inside one, nothing runs.
 */
const W = 1 / 9;
const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 720;

async function goRaw(page: Page, r: number) {
  await page.evaluate((r) => {
    const t = document.querySelector('.td-track')!;
    const top = t.getBoundingClientRect().top + scrollY;
    scrollTo(0, top + r * (t.clientHeight - innerHeight));
  }, r);
  await page.waitForFunction((r) => Math.abs(+(document.querySelector('.td-stage') as HTMLElement).dataset.r! - r) < 0.0007, r, { timeout: 6000 });
  await page.waitForTimeout(350); // let the spring finish settling: a held frame is compared pixel for pixel
}
const goto = (page: Page, p: number) => goRaw(page, rawForP(p, isMobile(page)));
async function hold(page: Page, name: string, at = 0.5) {
  const [a, b] = holdRange(name, isMobile(page));
  await goRaw(page, a + (b - a) * at);
}

/** Every inline transform and opacity on the stage, then '#' and a fingerprint of the canvas: the whole visible state. */
const snapshot = (page: Page) => page.locator('.td-stage').evaluate((s) => {
  const els = [...s.querySelectorAll<HTMLElement>('.td-world *, .td-sha, .td-head')];
  const c = s.querySelector('canvas') as HTMLCanvasElement | null;
  const d = c ? c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data : new Uint8ClampedArray(0);
  let hash = 7, ink = 0;
  for (let i = 3; i < d.length; i += 4) { if (d[i]) ink++; if (i % 97 === 3) hash = (hash * 31 + d[i]) | 0; }
  return els.map((e) => `${e.className}|${e.style.transform}|${e.style.opacity}|${e.style.clipPath}|${e.textContent}`).join(';') + `#${hash}#${ink}`;
});
const domOnly = (s: string) => s.split('#')[0];
const fingerprint = (s: string) => s.split('#')[1];
const ink = (s: string) => +s.split('#')[2];
/** The same frame: every element where it was, and the canvas holding the same drawing (anti-aliasing noise of a pixel or two aside). */
const same = (a: string, b: string) => domOnly(a) === domOnly(b) && Math.abs(ink(a) - ink(b)) <= Math.max(6, ink(a) * 0.004);
const trackVh = (page: Page) => page.locator('.td-track').evaluate((e) => e.getBoundingClientRect().height / innerHeight);
const ready = async (page: Page) => { await instrument(page); await page.goto('/work/maltrace/'); await expect(page.locator('.td-stage')).toBeVisible(); };

test('the story is 950-1000vh tall on desktop, set from story-map.ts', async ({ page }) => {
  await ready(page);
  const vh = await trackVh(page);
  expect(vh * 100).toBeGreaterThanOrEqual(950); expect(vh * 100).toBeLessThanOrEqual(1000);
  expect(vh).toBeCloseTo(storyLength(false) + 1, 1);
});

test('X-RAY dwell: the intact translucent file stays framed, identical from the start of the hold to its end', async ({ page }) => {
  await ready(page);
  await hold(page, 'xray', 0.02); const a = await snapshot(page);
  await hold(page, 'xray', 0.5); const b = await snapshot(page);
  await hold(page, 'xray', 0.98); const c = await snapshot(page);
  expect(same(b, a)).toBe(true); expect(same(c, a)).toBe(true);
  await expect(page.locator('.td-head')).toContainText('01 X-RAY');
  const rects = await page.locator('.td-slab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  for (let i = 1; i < rects.length; i++) expect(rects[i].top - rects[i - 1].bottom).toBeLessThan(4); // still one object
});

test('EXPLODE: separate, then the rail draws, then the leaders extend, then the labels resolve', async ({ page }) => {
  await ready(page);
  const stage = () => page.locator('.td-stage').evaluate((s) => {
    const labels = [...s.querySelectorAll<HTMLElement>('.td-lab')].filter((e) => e.textContent!.includes('entropy')).map((e) => +e.style.opacity);
    const c = s.querySelector('canvas') as HTMLCanvasElement, ctx = c.getContext('2d')!, all = ctx.getImageData(0, 0, c.width, c.height).data;
    let ink = 0; for (let i = 3; i < all.length; i += 4) if (all[i] > 0) ink++;
    const col = ctx.getImageData(Math.floor(c.width / 2) - 2, 0, 4, c.height).data; let rail = 0; for (let i = 3; i < col.length; i += 4) if (col[i] > 0) rail++;
    return { labels: Math.min(...labels), rail, ink };
  });
  await goto(page, 2.4 * W);
  expect((await stage()).labels).toBe(0);
  await goto(page, 2.5 * W);
  const separated = await stage();                 // separated: the rail has not started
  await goto(page, 2.62 * W);
  const rail = await stage();                      // rail drawn, leaders not started
  expect(rail.rail).toBeGreaterThan(separated.rail);
  await goto(page, 2.7 * W);
  const leaders = await stage();                   // leaders extending, labels still waiting
  expect(leaders.ink).toBeGreaterThan(rail.ink);
  expect(leaders.labels).toBe(0);
  await goto(page, 2.94 * W);
  expect((await stage()).labels).toBeGreaterThan(0.95);
});

test('EXPLODE dwell: the signature frame is identical at the start, the middle and the end of its hold', async ({ page }) => {
  await ready(page);
  await hold(page, 'explode', 0.02); const a = await snapshot(page);
  await hold(page, 'explode', 0.5); const b = await snapshot(page);
  await hold(page, 'explode', 0.98); const c = await snapshot(page);
  expect(same(b, a)).toBe(true); expect(same(c, a)).toBe(true);   // no geometry keeps drifting once it settles
  await expect(page.locator('.td-head')).toContainText('02 EXPLODE');
  const labels = await page.locator('.td-lab').filter({ hasText: 'entropy' }).evaluateAll((els) => els.map((e) => +(e as HTMLElement).style.opacity));
  expect(labels.every((o) => o > 0.99)).toBe(true);
  const ink = await page.locator('.td-canvas').evaluate((c: HTMLCanvasElement) => { const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  expect(ink).toBeGreaterThan(800);                // the rail and the leader lines are drawn
});

test('DETONATE dwell: the geometry is fixed, the stream moves with the scroll inside the hold, the numbers stay readable', async ({ page }) => {
  await ready(page);
  await hold(page, 'detonate', 0.1); const a = await snapshot(page);
  await hold(page, 'detonate', 0.5); const b = await snapshot(page);
  await hold(page, 'detonate', 0.9); const c = await snapshot(page);
  expect(domOnly(b)).toBe(domOnly(a)); expect(domOnly(c)).toBe(domOnly(a)); // every element is where it was
  expect(fingerprint(b)).not.toBe(fingerprint(a));                          // but the points moved, because the scroll position did
  expect(fingerprint(c)).not.toBe(fingerprint(b));
  await expect(page.locator('.td-total')).toHaveText('94,958 API calls');
  await expect(page.locator('.td-lab', { hasText: '17 processes' })).toHaveCount(1);
  expect(await page.locator('.td-proc').count()).toBe(17);
  expect(await page.locator('.td-api').count()).toBe(0);                    // and no API is attached to a section
});

test('VERDICT dwell: one stamp at the start of the beat, then true stillness for the whole hold', async ({ page }) => {
  await ready(page);
  const [start] = holdRange('verdict', false);
  const opacity = () => page.locator('.td-verdict').evaluate((e) => +(e.parentElement as HTMLElement).style.opacity);
  await goRaw(page, start - 0.03);
  expect(await opacity()).toBeLessThan(1);         // not stamped a moment earlier
  await hold(page, 'verdict', 0.02);
  expect(await opacity()).toBe(1);                 // stamped at the start of the beat
  const a = await snapshot(page);
  for (const at of [0.25, 0.5, 0.75, 0.98]) { await hold(page, 'verdict', at); expect(same(await snapshot(page), a), `at ${at}`).toBe(true); }
});

test('MAP dwell: every ATT&CK node is out and the frame is held before the pull-back', async ({ page }) => {
  await ready(page);
  await hold(page, 'map', 0.02); const a = await snapshot(page);
  await hold(page, 'map', 0.5); const b = await snapshot(page);
  await hold(page, 'map', 0.98); const c = await snapshot(page);
  expect(same(b, a)).toBe(true); expect(same(c, a)).toBe(true);
  const nodes = await page.locator('.td-tag').evaluateAll((els) => els.map((e) => +(e as HTMLElement).style.opacity));
  expect(nodes.every((o) => o === 1)).toBe(true);
  expect(await page.locator('.td-world').evaluate((e) => (e as HTMLElement).style.transform)).toContain('scale(1)');
  const [, end] = holdRange('map', false);
  await goRaw(page, end + 0.03);
  expect(await page.locator('.td-world').evaluate((e) => (e as HTMLElement).style.transform)).not.toContain('scale(1)'); // then the pull-back begins
});

test('reverse scroll leaves a hold smoothly: the picture changes a little per step, never in a jump', async ({ page }) => {
  test.setTimeout(120_000);
  await ready(page);
  for (const name of ['xray', 'explode', 'detonate', 'map']) {
    const [a] = holdRange(name, false);
    await hold(page, name, 0.5);
    const tops: number[] = [];
    for (let i = 0; i <= 10; i++) {
      await goRaw(page, a - i * 0.006);
      tops.push(await page.locator('.td-slab').nth(2).evaluate((e) => e.getBoundingClientRect().top));
    }
    for (let i = 1; i < tops.length; i++) expect(Math.abs(tops[i] - tops[i - 1]), `${name} step ${i}`).toBeLessThan(60);
  }
});

test('0 idle frames inside every hero hold, however the visitor arrived', async ({ page }) => {
  await ready(page);
  await page.waitForTimeout(1500);
  for (const name of ['xray', 'explode', 'detonate', 'verdict', 'map']) {
    await hold(page, name, 0.3);
    await hold(page, name, 0.7);   // scroll within the hold (the DETONATE stream moves), then stop
    await page.waitForTimeout(1300);
    await page.evaluate(() => { (window as any).__frames = 0; });
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => (window as any).__frames), name).toBe(0);
  }
});

test.describe('mobile dwell profile', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });

  test('a shorter story, not 1000vh on a phone, and the hero holds use the mobile lengths', async ({ page }) => {
    await ready(page);
    const vh = await trackVh(page);
    expect(vh).toBeCloseTo(storyLength(true) + 1, 1);
    expect(vh * 100).toBeLessThan(900);
    const ratio = storyLength(true) / storyLength(false);
    expect(ratio).toBeGreaterThanOrEqual(0.8); expect(ratio).toBeLessThanOrEqual(0.86);
    const len = (n: string, m: boolean) => { const [a, b] = holdRange(n, m); return (b - a) * storyLength(m); };
    for (const n of ['xray', 'explode', 'detonate', 'verdict', 'map']) expect(len(n, true), n).toBeLessThan(len(n, false));
  });

  test('the held frames are the same frames, and stay identical across their dwell', async ({ page }) => {
    await ready(page);
    for (const name of ['xray', 'explode', 'verdict', 'map']) {
      await hold(page, name, 0.05); const a = await snapshot(page);
      await hold(page, name, 0.95); const b = await snapshot(page);
      expect(same(b, a), name).toBe(true);
    }
    await hold(page, 'detonate', 0.1); const d1 = await snapshot(page);
    await hold(page, 'detonate', 0.9); const d2 = await snapshot(page);
    expect(domOnly(d2)).toBe(domOnly(d1)); expect(fingerprint(d2)).not.toBe(fingerprint(d1));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
