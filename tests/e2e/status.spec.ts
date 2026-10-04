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
