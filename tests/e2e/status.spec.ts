import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const claims = parse(readFileSync('src/content/claims/claims.yaml', 'utf8')) as { id: string; display: string; evidence: string | null }[];

test('/status renders every panel from real data', async ({ page }) => {
  await page.goto('/status/');
  await expect(page.locator('h1')).toHaveText('Status');
  for (const name of ['Release gate', 'Claims ledger', 'This visitor', 'Build history', 'Lab processes']) {
    await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
  }

  // gate panel: the verdict and each check with its own state
  const gate = page.locator('section[aria-labelledby="gate-h"]');
  await expect(gate.locator('.cell')).not.toHaveCount(0);
  await expect(gate.getByText('Claims have evidence')).toBeVisible();
  await expect(gate.locator('.chip').first()).toHaveText(/PASS|BLOCK/);

  // claims ledger: one row per claim, UNVERIFIED where evidence is null
  const rows = page.locator('section[aria-labelledby="claims-h"] tbody tr');
  await expect(rows).toHaveCount(claims.length);
  const unverified = claims.filter((c) => !c.evidence).length;
  await expect(page.locator('section[aria-labelledby="claims-h"]').getByText('UNVERIFIED', { exact: true })).toHaveCount(unverified);

  // history: at most 15 commits
  const commits = await page.locator('section[aria-labelledby="hist-h"] li').count();
  expect(commits).toBeGreaterThan(0);
  expect(commits).toBeLessThanOrEqual(15);

  // lab: process table
  await expect(page.locator('section[aria-labelledby="lab-h"] tbody tr')).not.toHaveCount(0);
});

test('/status render panel is read live from this browser', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  await page.goto('/status/');
  const cells = page.locator('[data-render-panel] .cell-value');
  await expect(cells.nth(0)).toHaveText('A');
  await expect(cells.nth(1)).toHaveText(/^\d+(\.\d+)?$/);
  await expect(cells.nth(2)).toHaveText(/^(yes|no)$/);
  await expect(cells.nth(3)).toHaveText('no');
});

test('/status render panel reports reduced motion and tier C', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/status/');
  const cells = page.locator('[data-render-panel] .cell-value');
  await expect(cells.nth(0)).toHaveText('C');
  await expect(cells.nth(3)).toHaveText('yes');
  await ctx.close();
});

test('the homepage telemetry strip is one row of real cells and opens /status', async ({ page }) => {
  await page.goto('/');
  const strip = page.locator('[data-strip]');
  await expect(strip).toHaveAttribute('href', '/status/');
  const tops = await strip.locator('.cell').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1); // strictly one row
  await expect(strip.getByText('Commit')).toBeVisible();
  await expect(strip.getByText('Pages built')).toBeVisible();
  await strip.click();
  await expect(page).toHaveURL(/\/status\/$/);
});

const routes = ['/', '/work/', '/work/rexi/', '/work/maltrace/', '/lab/', '/systems/', '/status/', '/about/', '/contact/', '/plain/', '/logs/'];

test('T3: at most one inverted block on any page', async ({ page }) => {
  for (const r of routes) {
    await page.goto(r);
    expect(await page.locator('.inverted').count(), r).toBeLessThanOrEqual(1);
  }
  await page.goto('/');
  await expect(page.locator('.inverted')).toHaveText('Model proposes. Software authorizes.');
  await page.goto('/work/rexi/');
  await expect(page.locator('.inverted')).toContainText('LLMs are good at language.');
});

test('T2: hard shadows exist only on interactive elements, and none at rest on static content', async ({ page }) => {
  for (const r of routes) {
    await page.goto(r);
    const offenders = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((e) => getComputedStyle(e).boxShadow !== 'none' && !['A', 'BUTTON'].includes(e.tagName))
        .map((e) => e.tagName + '.' + e.className));
    expect(offenders, r).toEqual([]);
  }
});

test('T2: reduced motion removes the hover translate', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  const enter = page.locator('.enter');
  await enter.hover();
  expect(await enter.evaluate((e) => getComputedStyle(e).transform)).toBe('none');
  await ctx.close();
});

test('T2: on hover a button presses into its shadow', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); });
  await page.goto('/');
  const enter = page.locator('.enter');
  expect(await enter.evaluate((e) => getComputedStyle(e).boxShadow)).toMatch(/4px 4px 0px/);
  await enter.hover();
  await expect.poll(() => enter.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41)).toBe(4);
});

test('T4: grid coordinates sit on the 48px grid of the hero and the status page', async ({ page }) => {
  for (const [path, host] of [['/', '.hero-scene'], ['/status/', '.head']] as const) {
    await page.goto(path);
    const r = await page.evaluate((sel) => {
      const h = document.querySelector(sel)!.getBoundingClientRect();
      return [...document.querySelectorAll(`${sel} .coords span`)].map((s) => ({ t: s.textContent, dx: Math.round(s.getBoundingClientRect().left - h.left) }));
    }, host);
    expect(r.map((x) => x.t).slice(0, 4), path).toEqual(['00', '04', '08', '12']);
    r.forEach((x, i) => expect(x.dx % 48, `${path} ${x.t}`).toBe(0));
    expect(r[1].dx - r[0].dx).toBe(192);
  }
});

test('every page other than the homepage hero idles at 0 frames', async ({ page }) => {
  test.setTimeout(90_000);
  const { instrument } = await import('./helpers');
  await instrument(page);
  for (const r of routes.filter((x) => x !== '/')) {
    await page.goto(r);
    await page.waitForTimeout(2200); // decrypt, redaction and count-ups have finished
    await page.evaluate(() => { (window as any).__frames = 0; });
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => (window as any).__frames), r).toBe(0);
  }
});
