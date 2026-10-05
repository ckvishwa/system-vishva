import { test, expect } from '@playwright/test';
import { instrument } from './helpers';

test('QualityMesh is labelled as simulated, links the real gate, and decides with the shared rule', async ({ page }) => {
  await page.goto('/work/qualitymesh/');
  const demo = page.locator('[data-release-gate]');
  await expect(demo).toContainText('Simulated inputs. The real gate for this site is on /status.');
  await expect(demo.getByRole('link', { name: '/status' })).toHaveAttribute('href', '/status/');

  const decision = demo.locator('[data-decision]');
  await expect(decision).toHaveText('SHIP');

  await demo.locator('[data-check="e2e"]').selectOption('fail');
  await expect(decision).toHaveText('BLOCK');
  await expect(demo.locator('[data-reasons]')).toContainText('End-to-end tests: failing');

  await demo.locator('[data-check="claims"]').selectOption('missing');
  await expect(demo.locator('[data-reasons]')).toContainText('Claims verified: no evidence');
  await expect(demo.locator('[data-reasons] li')).toHaveCount(2);

  await demo.locator('[data-check="e2e"]').selectOption('pass');
  await demo.locator('[data-check="claims"]').selectOption('pass');
  await expect(decision).toHaveText('SHIP');
});

test('the verdict colour follows the decision: green for SHIP, red for BLOCK', async ({ page }) => {
  await page.goto('/work/qualitymesh/');
  const value = page.locator('[data-verdict] .cell-value');
  const colour = (c: string) => page.evaluate((v) => { const t = document.createElement('i'); t.style.color = `var(${v})`; document.body.append(t); const r = getComputedStyle(t).color; t.remove(); return r; }, c);
  expect(await value.evaluate((e) => getComputedStyle(e).color)).toBe(await colour('--c-system'));
  await page.locator('[data-check="tests"]').selectOption('fail');
  expect(await value.evaluate((e) => getComputedStyle(e).color)).toBe(await colour('--c-risk'));
});

test('the demo is reachable by keyboard and adds no frame loop', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/qualitymesh/');
  await page.waitForTimeout(2200); // decrypt and redaction have finished
  await page.locator('[data-check="claims"]').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-decision]')).toHaveText('BLOCK');
  await page.waitForTimeout(1000); // focusing scrolled the page; the story's one-shot re-measure has run
  await page.evaluate(() => { (window as any).__frames = 0; });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).__frames)).toBe(0);
});
