import { test, expect, type Page } from '@playwright/test';
import { instrument } from './helpers';
import { holdRange, rawForP, storyLength } from '../../src/engine/motion/story-map';

const NAMES = ['SEALED', 'X-RAY', 'EXPLODE', 'DETONATE', 'DISTILL', 'DECIDE', 'VERDICT', 'EXPLAIN', 'MAP'];
const W = 1 / 9;
const SHA = 'ed01ebfbc9eb5bbea545af4d01bf5f1071661840480439c6e5babe8e080e41aa';

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 720;

/** Scroll so the stage is at RAW progress `r` (0..1 of its travel), and wait for the spring to land there. */
async function goRaw(page: Page, r: number) {
  await page.evaluate((r) => {
    const t = document.querySelector('.td-track')!;
    const top = t.getBoundingClientRect().top + scrollY;
    scrollTo(0, top + r * (t.clientHeight - innerHeight));
  }, r);
  await page.waitForFunction((r) => Math.abs(+(document.querySelector('.td-stage') as HTMLElement).dataset.r! - r) < 0.0007, r, { timeout: 6000 });
  await page.waitForTimeout(60);
}

/** Scroll to where the story's timeline reaches mapped progress `p` (the pacing is in story-map.ts; this works for either profile). */
const goto = (page: Page, p: number) => goRaw(page, rawForP(p, isMobile(page)));

/** Scroll to a point inside a named hold: 0 = its start, 0.5 = its centre, 1 = its end. */
async function hold(page: Page, name: string, at = 0.5) {
  const [a, b] = holdRange(name, isMobile(page));
  await goRaw(page, a + (b - a) * at);
}

/** Every inline transform and opacity on the stage, plus a fingerprint of the canvas: the whole visible state of the stage. */
const snapshot = (page: Page, skip = '') => page.locator('.td-stage').evaluate((s, skip) => {
  const els = [...s.querySelectorAll<HTMLElement>('.td-world *, .td-sha, .td-head')].filter((e) => !skip || !e.matches(skip));
  const c = s.querySelector('canvas') as HTMLCanvasElement | null;
  const px = c ? c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.reduce((a, v, i) => (i % 97 === 0 ? (a * 31 + v) | 0 : a), 7) : 0;
  return els.map((e) => `${e.className}|${e.style.transform}|${e.style.opacity}|${e.style.clipPath}|${e.textContent}`).join(';') + `#${px}`;
}, skip);

const ready = async (page: Page, path = '/work/maltrace/') => { await instrument(page); await page.goto(path); await expect(page.locator('.td-stage')).toBeVisible(); };

test('every one of the 9 states is reachable by scrolling', async ({ page }) => {
  await ready(page);
  const head = page.locator('.td-head');
  for (let k = 0; k < 9; k++) {
    if (k === 6) await hold(page, 'verdict'); else await goto(page, (k + 0.5) * W); // VERDICT lies in the stillness: it is reached by its hold
    await expect(head).toContainText(`0${k} ${NAMES[k]}`);
  }
  await expect(head).toContainText('Analysis 15');
});

test('REVERSE SCROLL REASSEMBLES THE FILE: out to the end and back is identical to never having left', async ({ page }) => {
  await ready(page);
  await goto(page, 0);
  await page.waitForTimeout(300);
  const sealed = await snapshot(page);
  for (const r of [0.2, 0.4, 0.6, 0.8, 1, 0.8, 0.6, 0.4, 0.2, 0]) await goRaw(page, r);
  await page.waitForTimeout(300);
  expect(await snapshot(page)).toBe(sealed);
  const slabs = page.locator('.td-slab');
  await expect(slabs).toHaveCount(4);
  expect(await slabs.evaluateAll((els) => els.map((e) => (e as HTMLElement).style.opacity))).toEqual(['0', '0', '0', '0']); // one opaque object again
});

test('SEALED is one opaque object; X-RAY makes the SAME object translucent with the sections inside it, nothing separated', async ({ page }) => {
  await ready(page);
  await goto(page, 0.4 * W);
  const shell = page.locator('.td-shell');
  await expect(shell).toHaveCount(1);
  const fill = () => shell.evaluate((e) => Number((e as HTMLElement).style.getPropertyValue('--f')));
  const sealedFill = await fill();
  expect(sealedFill).toBeGreaterThan(0.2);
  const sealedBox = (await shell.boundingBox())!;
  await goto(page, 1.9 * W);
  const xray = (await shell.boundingBox())!;
  expect(xray.x).toBeCloseTo(sealedBox.x, -1);              // the same object, in the same place
  expect(await fill()).toBeLessThan(sealedFill);            // translucent: the fill has dimmed
  const rects = await page.locator('.td-slab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  rects.forEach((r) => { expect(r.left).toBeGreaterThanOrEqual(xray.x - 3); expect(r.right).toBeLessThanOrEqual(xray.x + xray.width + 3); expect(r.top).toBeGreaterThanOrEqual(xray.y - 3); expect(r.bottom).toBeLessThanOrEqual(xray.y + xray.height + 3); }); // inside the shell
  for (let i = 1; i < rects.length; i++) expect(rects[i].top - rects[i - 1].bottom, 'no gap yet').toBeLessThan(4);
  // the data has no raw offsets, so the bands are equal and nothing claims offset positioning
  const hs = rects.map((r) => r.height);
  hs.forEach((h) => expect(h).toBeCloseTo(hs[0], 0));
  expect(await page.locator('.td-doc').textContent()).not.toMatch(/raw offset|virtual address/);
});

test('EXPLODE: an envelope remains and the sections lift out in 3D, derived from their index, tilted at most 12 degrees', async ({ page }) => {
  await ready(page);
  await goto(page, 2.9 * W);
  expect(await page.locator('.td-world').evaluate((e) => getComputedStyle(e).perspective)).toBe('1200px');
  const three = await page.locator('.td-stage').evaluate((s) => [...s.querySelectorAll<HTMLElement>('*')].filter((e) => getComputedStyle(e).transformStyle === 'preserve-3d').map((e) => e.className));
  expect(three).toEqual(['td-slabs']);   // preserve-3d on the slab group and nowhere else
  expect(await page.locator('.td-slab').first().evaluate((e) => getComputedStyle(e).backfaceVisibility)).toBe('hidden');
  const tf = await page.locator('.td-slab').evaluateAll((els) => els.map((e) => { const m = (e as HTMLElement).style.transform; const n = (re: RegExp) => parseFloat(m.match(re)![1]); return { x: n(/translate3d\(\s*([-\d.e]+)px/), z: n(/translate3d\([^,]+,[^,]+,\s*([-\d.e]+)px/), rx: n(/rotateX\(([-\d.e]+)deg/), ry: n(/rotateY\(([-\d.e]+)deg/) }; }));
  tf.forEach((t) => { expect(Math.abs(t.rx)).toBeLessThanOrEqual(12); expect(Math.abs(t.ry)).toBeLessThanOrEqual(12); });
  // even slabs left and forward, odd slabs right and back
  expect(tf[0].x).toBeLessThan(tf[1].x); expect(tf[2].x).toBeLessThan(tf[3].x);
  expect(tf[0].z).toBeGreaterThan(tf[1].z); expect(tf[2].z).toBeGreaterThan(tf[3].z);
  const edge = await page.locator('.td-shell').evaluate((e) => +(e as HTMLElement).style.opacity);
  expect(edge).toBeGreaterThan(0.2); expect(edge).toBeLessThan(0.7); // the faint reference envelope is still there
});

test('annotations are flat 2D, show only real data, and HIGH ENTROPY appears once', async ({ page }) => {
  await ready(page);
  await goto(page, 2.9 * W);
  const labels = await page.locator('.td-lab').filter({ hasText: 'entropy' }).allTextContents();
  expect(labels).toHaveLength(4);
  expect(labels[0]).toMatch(/^1\s+\.text\nraw size 28,672 B\nvirtual size 27,056 B\nentropy 6\.40$/);
  expect(labels[3]).toContain('entropy 8.00 · HIGH ENTROPY');
  expect(labels.filter((l) => l.includes('HIGH ENTROPY'))).toHaveLength(1);
  expect(labels.join()).not.toMatch(/pack|raw offset|virtual address/i);
  expect(await page.locator('.td-slabs .td-lab').count()).toBe(0);   // the labels are not inside the 3D group
  // the rail is on the canvas: ink exists on the central column
  const ink = await page.locator('.td-canvas').evaluate((c: HTMLCanvasElement) => { const d = c.getContext('2d')!.getImageData(Math.floor(c.width / 2) - 3, 0, 6, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
  expect(ink).toBeGreaterThan(100);
});

test('the layers show the real numbers: API total, processes, matrix, model, verdict, SHAP, ATT&CK, chain', async ({ page }) => {
  await ready(page);
  await goto(page, 1.2 * W);
  await expect(page.locator('.td-title')).toHaveText('wannacry.exe · 3,514,368 bytes');
  await expect(page.locator('.td-sha')).toHaveText(SHA); // settled

  await goto(page, 3.9 * W);
  await expect(page.locator('.td-total')).toHaveText('94,958 API calls'); // resolves to the real total
  expect(await page.locator('.td-proc').count()).toBe(17);               // process_count nodes, no invented edges
  await expect(page.locator('.td-lab', { hasText: '17 processes' })).toHaveCount(1);

  await goto(page, 4.4 * W);
  expect(await page.locator('.td-cell').count()).toBe(54);
  expect(await page.locator('.td-cell.is-static').count()).toBe(8);
  await expect(page.locator('.td-lab', { hasText: '46 dynamic behavioral' })).toHaveCount(1);

  await goto(page, 5.5 * W);
  await expect(page.locator('.td-model')).toHaveText('Random forest');

  await hold(page, 'verdict');
  await expect(page.locator('.td-verdict')).toHaveText('95% malicious confidence on this sample');
  await expect(page.locator('.td-verdict')).not.toContainText('94.2');

  await goto(page, 7.7 * W);
  expect(await page.locator('.td-push').count()).toBe(10);
  expect(await page.locator('.td-push.is-risk').count()).toBe(5);
  expect(await page.locator('.td-push.is-ok').count()).toBe(5);

  await goto(page, 1);
  const tags = page.locator('.td-tag');
  expect(await tags.count()).toBe(13);
  await expect(tags.first()).toHaveAttribute('href', 'https://attack.mitre.org/techniques/T1027/');
  await expect(tags.nth(1)).toHaveAttribute('href', 'https://attack.mitre.org/techniques/T1027/002/');
  const chain = page.locator('.td-chain');
  await expect(chain).toHaveCount(7);
  await expect(chain.nth(0)).toContainText('Hash');
  await expect(chain.nth(1)).toContainText('17 processes');
  await expect(chain.nth(2)).toContainText('94,958');
  await expect(chain.nth(3)).toContainText('54 features');
  await expect(chain.nth(4)).toContainText('95%');
  await expect(chain.nth(5)).toContainText('malscore');
  await expect(chain.nth(6)).toContainText('13 techniques');
});

test('DETONATE: points fly through the gaps, and no per-API row sits beside any PE section', async ({ page }) => {
  await ready(page);
  await goto(page, 3.6 * W);
  expect(await page.locator('.td-api').count()).toBe(0);
  const gaps = await page.locator('.td-slab').evaluateAll((els) => { const r = els.map((e) => e.getBoundingClientRect()); return r.slice(1).map((b, i) => ({ top: r[i].bottom, bottom: b.top })); });
  const rows = await page.locator('.td-canvas').evaluate((c: HTMLCanvasElement) => {
    const dpr = c.width / c.getBoundingClientRect().width, d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data, ys: number[] = [];
    for (let y = 0; y < c.height; y++) { let n = 0; for (let x = 0; x < c.width; x += 2) { const o = (y * c.width + x) * 4; if (d[o + 3] > 150 && d[o + 2] > 200 && d[o] < 130) n++; } if (n > 2) ys.push(y / dpr + c.getBoundingClientRect().top); }
    return ys;
  });
  expect(rows.length).toBeGreaterThan(8);   // blue stream points exist
  const inGap = rows.filter((y) => gaps.some((g) => y > g.top - 40 && y < g.bottom + 40)).length;
  expect(inGap / rows.length).toBeGreaterThan(0.5);
});

test('VERDICT is absolute stillness: nothing but the verdict changes', async ({ page }) => {
  await ready(page);
  await goto(page, 6.05 * W);
  const skip = '.td-verdict, .td-redact, .td-layer:has(.td-verdict)';
  const a = await snapshot(page, skip);
  const stamped = (p: Page) => p.locator('.td-verdict').evaluate((e) => (e.parentElement as HTMLElement).style.opacity);
  expect(await stamped(page)).toBe('0');
  await hold(page, 'verdict', 0.5);
  const b = await snapshot(page, skip);
  expect(await stamped(page)).toBe('1');   // the verdict itself did change
  await hold(page, 'verdict', 1);
  const c = await snapshot(page, skip);
  expect(b).toBe(a);
  expect(c).toBe(a);
});

test('the camera pushes in on SEALED and pulls back at the end of MAP; there is no separate pull-back state', async ({ page }) => {
  await ready(page);
  const scale = () => page.locator('.td-world').evaluate((e) => (e as HTMLElement).style.transform.match(/scale\(([\d.]+)\)/)![1]).then(Number);
  await goto(page, 0);
  const sealed = await scale();
  await goto(page, 1.5 * W);
  const pushed = await scale();
  await goto(page, 8.3 * W);
  const map = await scale();
  await goto(page, 1);
  const pulled = await scale();
  expect(sealed).toBeLessThan(pushed);
  expect(map).toBeCloseTo(1, 1);
  expect(pulled).toBeCloseTo(0.62, 2);
  await expect(page.locator('.td-head')).toContainText('08 MAP');
  await expect(page.locator('.td-chain').first()).toBeVisible();
});

test('the animated stage is aria-hidden over the same content, which stays in the document', async ({ page }) => {
  await ready(page);
  await expect(page.locator('.td-stage')).toHaveAttribute('aria-hidden', 'true');
  const doc = page.locator('.td-doc');
  await expect(doc.getByRole('heading', { level: 3 })).toHaveCount(9);
  await expect(doc).toContainText('94,958 API calls');
  await expect(doc).toContainText('95% malicious confidence on this sample');
});

test('0 idle frames on /work/maltrace/ after scrolling stops', async ({ page }) => {
  await ready(page);
  await page.waitForTimeout(2200);
  for (let r = 0; r <= 1.001; r += 0.1) await goRaw(page, Math.min(1, r));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { (window as any).__frames = 0; });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).__frames)).toBe(0);
});

test('the stage code is a lazy chunk: only the MalTrace case study fetches it', async ({ page }) => {
  const seen: string[] = [];
  page.on('request', (r) => { if (/\/_astro\/teardown\.[^/]+\.js$/.test(r.url())) seen.push(r.url()); });
  await instrument(page);
  await page.goto('/work/rexi/');
  await page.waitForTimeout(800);
  expect(seen).toHaveLength(0);
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toBeVisible();
  expect(seen).toHaveLength(1);
});

const STATIC_TEXT = ['wannacry.exe, 3,514,368 bytes', SHA, '.rsrc', '3,448,832', '3,448,736', 'HIGH ENTROPY', '94,958 API calls', 'across 17 processes', 'NtClose', '10,733', 'All other APIs',
  '54 features', '46 dynamic behavioral + 8 static PE', 'pe_entropy', 'Random forest', '95% malicious confidence on this sample', 'not model accuracy', 'SHAP base value 0.501', 'malscore', '+0.0885',
  'T1486', 'creates_suspended_process', 'The investigation chain', '4 PE sections'];

test('reduced motion: no sticky stage; all 9 states render as a static document with every number visible', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/work/maltrace/');
  await page.waitForTimeout(500);
  await expect(page.locator('.td-stage, .td-track, canvas')).toHaveCount(0);
  const states = page.locator('.td-state');
  await expect(states).toHaveCount(9);
  for (let k = 0; k < 9; k++) await expect(states.nth(k).getByRole('heading', { level: 3 })).toContainText(`0${k} ${NAMES[k]}`);
  for (const text of STATIC_TEXT) await expect(page.locator('[data-teardown]'), text).toContainText(text);
  expect(await page.locator('[data-td-attack]').count()).toBe(13);
  await expect(page.locator('[data-td-api]')).toHaveCount(13);
  await expect(states.first()).toBeVisible();
  await expect(states.last()).toBeVisible();
  await expect(page.locator('td.info', { hasText: 'HIGH ENTROPY' })).toHaveCount(1);
  await ctx.close();
});

test('/plain renders the teardown as a static document, with no stage and no canvas', async ({ page }) => {
  await page.goto('/plain/');
  await expect(page.locator('.td-stage, .td-track, canvas')).toHaveCount(0);
  await expect(page.locator('.td-state')).toHaveCount(9);
  await expect(page.locator('[data-teardown]')).toContainText('94,958 API calls');
});

test('one inverted block on the MalTrace page: the verdict', async ({ page }) => {
  await page.goto('/work/maltrace/');
  await expect(page.locator('.inverted')).toHaveCount(1);
  await expect(page.locator('.inverted')).toHaveText('95% malicious confidence on this sample');
});

test('the hash settles character by character', async ({ page }) => {
  await ready(page);
  await goto(page, 0);
  const start = await page.locator('.td-sha').textContent();
  expect(start).not.toBe(SHA);
  expect(start).toHaveLength(64);
  await goto(page, 0.25 * W);
  const mid = (await page.locator('.td-sha').textContent())!;
  const settled = [...mid].findIndex((c, i) => c !== SHA[i]);
  expect(settled).toBeGreaterThan(8);
  expect(settled).toBeLessThan(64);
  await goto(page, 1.2 * W);
  await expect(page.locator('.td-sha')).toHaveText(SHA);
});

/** Count of non-transparent pixels on the stream canvas. */
const ink = (page: Page) => page.locator('.td-canvas').evaluate((c: HTMLCanvasElement) => {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
});

test('one 2D canvas: the stream is dense while it runs and gone before the verdict', async ({ page }) => {
  await ready(page);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await page.locator('.td-canvas').evaluate((c: HTMLCanvasElement) => !!c.getContext('2d'))).toBe(true);
  await goto(page, 3.6 * W);
  const running = await ink(page);
  await hold(page, 'verdict');
  const still = await ink(page);
  expect(running).toBeGreaterThan(1500);
  expect(still).toBeLessThan(running / 3);   // only the faint rail remains: no stream points
});

test('the stream never shows more than 600 points', async ({ page }) => {
  await ready(page);
  await goto(page, 3.6 * W);
  const size = await page.locator('.td-canvas').evaluate((c: HTMLCanvasElement) => Math.max(2, Math.round((c.width / Math.min(2, window.devicePixelRatio || 1)) / 400)) * 2 * Math.min(2, window.devicePixelRatio || 1));
  expect(await ink(page)).toBeLessThanOrEqual(600 * (size + 2) * (size + 2) + 6000);
});

test('gyro adds depth only: at most 6 px on the slabs, and it never changes progress', async ({ page }) => {
  await ready(page);
  await goto(page, 2.9 * W);
  const pos = () => page.locator('.td-slab').evaluateAll((els) => els.map((e) => { const m = (e as HTMLElement).style.transform.match(/translate3d\(([^,]+),([^,]+),/)!; return [parseFloat(m[1]), parseFloat(m[2])]; }));
  await page.waitForTimeout(1200);
  const before = await pos();
  const p0 = await page.locator('.td-stage').getAttribute('data-r');
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 90, beta: 180 })));
  await page.waitForTimeout(700);
  const after = await pos();
  const moved = after.map((a, i) => Math.hypot(a[0] - before[i][0], a[1] - before[i][1]));
  moved.forEach((d) => expect(d).toBeLessThanOrEqual(6 * Math.SQRT2 + 0.01));
  expect(Math.max(...moved)).toBeGreaterThan(1);
  expect(await page.locator('.td-stage').getAttribute('data-r')).toBe(p0);
  expect(new URL(page.url()).pathname).toBe('/work/maltrace/');
  expect(moved[3]).toBeGreaterThan(moved[0]);   // the deepest slab moves most
});

test('0 idle frames after a gyro burst settles', async ({ page }) => {
  await ready(page);
  await goto(page, 2.9 * W);
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 40, beta: 100 })));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { (window as any).__frames = 0; });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).__frames)).toBe(0);
});

test('desktop: even annotations on the left, odd on the right, each beside the stack', async ({ page }) => {
  await ready(page);
  await goto(page, 2.9 * W);
  const labs = await page.locator('.td-lab').filter({ hasText: 'entropy' }).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right }; }));
  const shell = (await page.locator('.td-shell').boundingBox())!;
  expect(labs[0].r).toBeLessThan(shell.x); expect(labs[2].r).toBeLessThan(shell.x);
  expect(labs[1].l).toBeGreaterThan(shell.x + shell.width); expect(labs[3].l).toBeGreaterThan(shell.x + shell.width);
});

test.describe('mobile (390 px)', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });

  test('the same exploded-object metaphor runs vertically: slabs separate downward in one column, 70-82% wide', async ({ page }) => {
    await ready(page);
    await goto(page, 2.9 * W);
    const boxes = await page.locator('.td-slab').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].y, `slab ${i}`).toBeGreaterThan(boxes[i - 1].y + boxes[i - 1].h + 8);
    const stage = (await page.locator('.td-stage').boundingBox())!;
    const widest = Math.max(...boxes.map((b) => b.w)) / stage.width;
    expect(widest).toBeGreaterThan(0.62); expect(widest).toBeLessThan(0.86);
    await expect(page.locator('.td-shell')).toHaveCount(1);
    expect(await page.locator('.td-canvas').count()).toBe(1); // the rail and the leaders
  });

  test('no horizontal overflow, and every slab stays in the viewport, in every state that shows them', async ({ page }) => {
    await ready(page);
    for (const k of [0.5, 1.5, 2.2, 2.6, 2.95, 3.5, 3.95, 4.2]) {
      await goto(page, k * W);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `p=${k}`).toBe(true);
      if (k >= 1.5 && k <= 3.95) {
        const rects = await page.locator('.td-slab').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }));
        rects.forEach((r, i) => { expect(r.l, `slab ${i} @${k}`).toBeGreaterThanOrEqual(0); expect(r.r, `slab ${i} @${k}`).toBeLessThanOrEqual(390); expect(r.t).toBeGreaterThanOrEqual(0); expect(r.b).toBeLessThanOrEqual(800); });
      }
    }
  });

  test('callout text never collides with the viewport edge, and the overlay is flat and alternates sides', async ({ page }) => {
    await ready(page);
    await goto(page, 2.95 * W);
    const labs = await page.locator('.td-lab').filter({ hasText: 'entropy' }).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, align: getComputedStyle(e).textAlign }; }));
    labs.forEach((r, i) => { expect(r.l, `label ${i} left`).toBeGreaterThanOrEqual(8); expect(r.r, `label ${i} right`).toBeLessThanOrEqual(390 - 8); });
    expect(labs.map((l) => l.align)).toEqual(['left', 'right', 'left', 'right']);
    expect(await page.locator('.td-slabs .td-lab').count()).toBe(0);
  });

  test('the process nodes and the total sit in the remaining space inside the stage', async ({ page }) => {
    await ready(page);
    await goto(page, 3.9 * W);
    await expect(page.locator('.td-total')).toHaveText('94,958 API calls');
    const stage = (await page.locator('.td-stage').boundingBox())!;
    for (const sel of ['.td-total', '.td-layer:has(.td-proc) .td-lab']) {
      const b = (await page.locator(sel).first().boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(stage.width + 1); expect(b.y + b.height).toBeLessThanOrEqual(800);
    }
    expect(await page.locator('.td-proc').count()).toBe(17);
  });

  test('the same 9-state timeline and the same real numbers', async ({ page }) => {
    await ready(page);
    for (let k = 0; k < 9; k++) { if (k === 6) await hold(page, 'verdict'); else await goto(page, (k + 0.5) * W); await expect(page.locator('.td-head')).toContainText(`0${k} ${NAMES[k]}`); }
    await hold(page, 'verdict');
    await expect(page.locator('.td-verdict')).toHaveText('95% malicious confidence on this sample');
    await goto(page, 1);
    expect(await page.locator('.td-tag').count()).toBe(13);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('the static fallback stays complete under reduced motion on mobile', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/work/maltrace/');
    await page.waitForTimeout(500);
    await expect(page.locator('.td-stage, canvas')).toHaveCount(0);
    await expect(page.locator('.td-state')).toHaveCount(9);
    for (const text of STATIC_TEXT) await expect(page.locator('[data-teardown]'), text).toContainText(text);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await ctx.close();
  });
});
