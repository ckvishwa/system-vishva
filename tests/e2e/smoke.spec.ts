import { test, expect } from '@playwright/test';

test('every primary route loads', async ({ page }) => {
  for (const path of ['/', '/work/', '/work/rexi/', '/work/maltrace/', '/lab/', '/systems/', '/about/', '/contact/', '/plain/', '/logs/']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});

test('reduced motion forces tier C', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'C');
});

test('unknown route fails closed', async ({ page }) => {
  await page.goto('/nope');
  await expect(page.getByText('This route is not in the allowlist.')).toBeVisible();
});
