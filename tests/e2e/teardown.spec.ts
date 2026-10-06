import { test, expect, type Page } from '@playwright/test';
import { instrument } from './helpers';

const NAMES = ['SEALED', 'CRACK', 'DETONATE', 'DISTILL', 'DECIDE', 'EXPLAIN', 'MAP', 'PULL-BACK'];

/** Scroll so the stage is at `p` (0..1) of its travel. */
async function goto(page: Page, p: number) {
  await page.evaluate((p) => {
    const t = document.querySelector('.td-track')!;
    const top = t.getBoundingClientRect().top + scrollY;
    scrollTo(0, top + p * (t.clientHeight - innerHeight));
  }, p);
  // the displayed progress glides to the scroll position on a spring: wait until it has landed
  await page.waitForFunction((p) => Math.abs(+(document.querySelector('.td-stage') as HTMLElement).dataset.p! - p) < 0.003, p, { timeout: 5000 });
  await page.waitForTimeout(60);
}

test('every one of the 8 states is reachable by scrolling, and scrolling back reassembles', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toBeVisible();
  const head = page.locator('.td-head');
  for (let k = 0; k < 8; k++) {
    await goto(page, (k + 0.5) / 8);
    await expect(head).toContainText(`0${k} ${NAMES[k]}`);
  }
  // back to the start: the block is sealed again, nothing exploded
  await goto(page, 0);
  await expect(head).toContainText('00 SEALED');
  const slabs = page.locator('.td-slab');
  await expect(slabs).toHaveCount(4);
  const tops = await slabs.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(tops[1] - tops[0]).toBeLessThan(12); // stacked: only the first slab's own height apart
});

test('the layers show the real numbers: sections, API total, verdict, SHAP, ATT&CK', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toBeVisible();
  await goto(page, 1.2 / 8);
  await expect(page.locator('.td-title')).toHaveText('wannacry.exe · 3,514,368 bytes');
  await expect(page.locator('.td-sha')).toHaveText('ed01ebfbc9eb5bbea545af4d01bf5f1071661840480439c6e5babe8e080e41aa'); // settled

  await goto(page, 1.5 / 8);
  const labels = await page.locator('.td-slab + .td-lab, .td-lab').filter({ hasText: 'entropy' }).allTextContents();
  expect(labels.filter((l) => l.includes('HIGH ENTROPY'))).toHaveLength(1); // only .rsrc, at 8.00
  expect(labels.find((l) => l.includes('.rsrc'))).toContain('HIGH ENTROPY');
  expect(labels.join()).not.toMatch(/pack/i);

  await goto(page, 3 / 8);
  await expect(page.locator('.td-total')).toHaveText('94,958 API calls');
  expect(await page.locator('.td-api').count()).toBe(12);
  expect(await page.locator('.td-proc').count()).toBe(17); // process_count nodes, no invented edges

  await goto(page, 4.4 / 8);
  await expect(page.locator('.td-verdict')).toHaveText('95% malicious confidence on this sample');
  await expect(page.locator('.td-verdict')).not.toContainText('94.2');

  await goto(page, 5.5 / 8);
  expect(await page.locator('.td-push').count()).toBe(10);
  expect(await page.locator('.td-push.is-risk').count()).toBe(5);
  expect(await page.locator('.td-push.is-ok').count()).toBe(5);

  await goto(page, 1);
  const tags = page.locator('.td-tag');
  expect(await tags.count()).toBe(13);
  await expect(tags.first()).toHaveAttribute('href', 'https://attack.mitre.org/techniques/T1027/');
  await expect(tags.nth(1)).toHaveAttribute('href', 'https://attack.mitre.org/techniques/T1027/002/');
  // PULL-BACK: the whole chain, with the pipeline's names and real numbers
  const chain = page.locator('.td-chain');
  await expect(chain).toHaveCount(7);
  await expect(chain.nth(0)).toContainText('Hash');
  await expect(chain.nth(0)).toContainText('ed01ebfb…');
  await expect(chain.nth(1)).toContainText('17 processes');
  await expect(chain.nth(2)).toContainText('94,958');
  await expect(chain.nth(3)).toContainText('54 features');
  await expect(chain.nth(4)).toContainText('95%');
  await expect(chain.nth(5)).toContainText('malscore');
  await expect(chain.nth(6)).toContainText('13 techniques');
});

test('the animated stage is aria-hidden over the same content, which stays in the document', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toHaveAttribute('aria-hidden', 'true');
  const doc = page.locator('.td-doc');
  await expect(doc.getByRole('heading', { level: 3 })).toHaveCount(8);
  await expect(doc).toContainText('94,958 API calls');
  await expect(doc).toContainText('95% malicious confidence on this sample');
});

test('0 idle frames on /work/maltrace/ after scrolling stops', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/maltrace/');
  await page.waitForTimeout(2200);
  for (let p = 0; p <= 1.001; p += 0.125) { await goto(page, Math.min(1, p)); }
  await page.waitForTimeout(1500); // the last scroll's one frame has run
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

test('reduced motion: no sticky stage; all 8 states render as a static document with every number visible', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/work/maltrace/');
  await page.waitForTimeout(500);
  await expect(page.locator('.td-stage, .td-track')).toHaveCount(0);
  const states = page.locator('.td-state');
  await expect(states).toHaveCount(8);
  for (let k = 0; k < 8; k++) await expect(states.nth(k).getByRole('heading', { level: 3 })).toContainText(`0${k} ${NAMES[k]}`);
  for (const text of ['wannacry.exe, 3,514,368 bytes', 'ed01ebfbc9eb5bbea545af4d01bf5f1071661840480439c6e5babe8e080e41aa', '.rsrc', '3,448,832', 'HIGH ENTROPY',
    '94,958 API calls', 'across 17 processes', 'NtClose', '10,733', '54 features', '46 dynamic behavioral + 8 static PE', 'pe_entropy',
    '95% malicious confidence on this sample', 'not model accuracy', 'SHAP base value 0.501', 'malscore', '+0.0885', 'T1486', 'creates_suspended_process', 'The investigation chain', 'Random forest'])
    await expect(page.locator('[data-teardown]'), text).toContainText(text);
  expect(await page.locator('[data-td-attack]').count()).toBe(13);
  // visible in reading order, not hidden
  await expect(states.first()).toBeVisible();
  await expect(states.last()).toBeVisible();
  // exactly one entropy note: only .rsrc is above 7.0
  await expect(page.locator('td.info', { hasText: 'HIGH ENTROPY' })).toHaveCount(1);
  await ctx.close();
});

test('/plain renders the teardown as a static document, with no stage', async ({ page }) => {
  await page.goto('/plain/');
  await expect(page.locator('.td-stage, .td-track')).toHaveCount(0);
  await expect(page.locator('.td-state')).toHaveCount(8);
  await expect(page.locator('[data-teardown]')).toContainText('94,958 API calls');
});

test('one inverted block on the MalTrace page: the verdict', async ({ page }) => {
  await page.goto('/work/maltrace/');
  await expect(page.locator('.inverted')).toHaveCount(1);
  await expect(page.locator('.inverted')).toHaveText('95% malicious confidence on this sample');
});

test('mobile: the exploded view runs vertically, labels sit below the slabs, nothing overflows sideways', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await instrument(page);
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toBeVisible();
  await goto(page, 2.45 / 8);
  const boxes = await page.locator('.td-slab').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
  expect(boxes[0].x).toBeCloseTo(boxes[3].x, 0);          // same column: they separate downward, not sideways
  for (let i = 1; i < boxes.length; i++) expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y + boxes[i - 1].h + 20); // real gaps, in order
  const labs = await page.locator('.td-lab').filter({ hasText: 'entropy' }).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().y));
  labs.slice(0, 4).forEach((y, i) => expect(y).toBeGreaterThanOrEqual(boxes[i].y + boxes[i].h)); // label is below its slab
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await ctx.close();
});

test('desktop: labels sit beside the slabs', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toBeVisible();
  await goto(page, 2.45 / 8);
  const slab = await page.locator('.td-slab').first().evaluate((e) => e.getBoundingClientRect().right);
  const lab = await page.locator('.td-lab').filter({ hasText: '.text' }).evaluate((e) => e.getBoundingClientRect().left);
  expect(lab).toBeGreaterThan(slab);
});

test('the camera pushes in on SEALED and pulls back to the chain: the world scale follows the timeline', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toBeVisible();
  const scale = () => page.locator('.td-world').evaluate((e) => (e as HTMLElement).style.transform.match(/scale\(([\d.]+)\)/)![1]).then(Number);
  await goto(page, 0);
  const sealed = await scale();
  await goto(page, 1.5 / 8);
  const pushed = await scale();
  await goto(page, 1);
  const pulled = await scale();
  expect(sealed).toBeLessThan(pushed);   // the camera pushes in through SEALED
  expect(pulled).toBeLessThan(pushed);   // and zooms out at the end
  expect(pulled).toBeCloseTo(0.62, 2);
});

test('STILLNESS: while the verdict stamps, nothing else on the stage moves', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toBeVisible();
  const snapshot = () => page.locator('.td-stage').evaluate((s) => [...s.querySelectorAll<HTMLElement>('.td-world, .td-world *, .td-sha')].filter((e) => !e.classList.contains('td-verdict') && !e.classList.contains('td-redact') && !e.closest('.td-layer:has(.td-verdict)')).map((e) => `${e.style.transform}|${e.style.opacity}`).join(';'));
  await goto(page, 4.1 / 8);   // the funnel has finished: stillness, before the stamp
  const before = await snapshot();
  await goto(page, 4.28 / 8);  // inside the stamp window
  const during = await snapshot();
  expect(during).toBe(before);
  // and the verdict itself has changed: it is stamped
  expect(await page.locator('.td-verdict').evaluate((e) => (e.parentElement as HTMLElement).style.opacity)).not.toBe('0');
});

test('the hash settles character by character', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/maltrace/');
  await expect(page.locator('.td-stage')).toBeVisible();
  const sha = 'ed01ebfbc9eb5bbea545af4d01bf5f1071661840480439c6e5babe8e080e41aa';
  await goto(page, 0);
  const start = await page.locator('.td-sha').textContent();
  expect(start).not.toBe(sha);                       // still scrambled
  expect(start).toHaveLength(64);
  await goto(page, 0.25 / 8);
  const mid = (await page.locator('.td-sha').textContent())!;
  const settled = [...mid].findIndex((c, i) => c !== sha[i]);
  expect(settled).toBeGreaterThan(8);                // a prefix is already the real hash...
  expect(settled).toBeLessThan(64);                  // ...and the rest has not settled yet
  await goto(page, 1.2 / 8);
  await expect(page.locator('.td-sha')).toHaveText(sha);
});
