import { test, expect } from '@playwright/test';

test('every primary route loads', async ({ page }) => {
  for (const path of ['/', '/work/', '/work/rexi/', '/work/maltrace/', '/lab/', '/systems/', '/status/', '/about/', '/contact/', '/plain/', '/logs/']) {
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

test('/plain has no effects: no data-fx element, tier C, no armed mode', async ({ page }) => {
  await page.goto('/plain/');
  await expect(page.locator('[data-fx]')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-tier', 'C');
  await expect(page.locator('html')).not.toHaveAttribute('data-fx-mode', /.+/);
});

test('no page shows TODO or placeholder text', async ({ page }) => {
  for (const path of ['/', '/work/', '/work/rexi/', '/work/maltrace/', '/lab/', '/systems/', '/status/', '/about/', '/contact/', '/plain/', '/logs/']) {
    await page.goto(path);
    // Commit subjects on /status and /logs are real git history, not page copy: leave the feeds out.
    await page.evaluate(() => document.querySelectorAll('ol.feed').forEach((el) => el.remove()));
    const text = await page.locator('body').innerText();
    expect(text, path).not.toMatch(/\bTODO\b|PLACEHOLDER/);
  }
});

test('/about is a structured fact block from profile.yaml and /contact has no LinkedIn line', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('dl.facts dt')).toHaveText(['Education', 'Education', 'Certification', 'Experience', 'Location', 'Seeking']);
  await page.goto('/contact/');
  await expect(page.getByRole('link', { name: /ckvishwateja@gmail.com/ })).toBeVisible();
  await expect(page.getByText(/linkedin/i)).toHaveCount(0);
});
