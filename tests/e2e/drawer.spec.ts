import { test, expect } from '@playwright/test';

const chunks = (page: import('@playwright/test').Page) => {
  const seen: string[] = [];
  page.on('request', (r) => { if (/\/_astro\/evidence-drawer\.[^/]+\.js$/.test(r.url())) seen.push(r.url()); });
  return seen;
};

test('the drawer chunk loads only on the first click, and shows an on-request claim honestly', async ({ page }) => {
  const seen = chunks(page);
  await page.goto('/work/rexi/');
  expect(seen).toHaveLength(0);

  const trigger = page.locator('[data-claim][data-kind="on-request"] [data-evidence-open]').first();
  await trigger.focus();
  await trigger.click();

  const dlg = page.getByRole('dialog', { name: /Automated tests/ });
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('available on request');
  await expect(dlg.locator('a[href^="http"]')).toHaveCount(0); // no link to a file that does not exist
  expect(seen).toHaveLength(1);

  // Esc closes, and focus goes back to the metric that opened it
  await page.keyboard.press('Escape');
  await expect(dlg).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('a self-hosted claim says the repo is private and the output is published', async ({ page }) => {
  await page.goto('/work/rexi/');
  await page.locator('[data-claim][data-kind="self-hosted"] [data-evidence-open]').first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('source: private repo, output published');
  await expect(dlg.getByRole('link', { name: 'Open the published output' })).toHaveAttribute('href', /^\/evidence\/rexi\/.+\.txt$/);
});

test('a public claim links to its source', async ({ page }) => {
  await page.goto('/work/maltrace/');
  await page.locator('[data-claim][data-kind="public"] [data-evidence-open]').first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Public source');
  await expect(dlg.locator('a[target="_blank"]')).toHaveAttribute('href', /^https:\/\/github\.com\/ckvishwa\/Maltrace\//);
});

test('focus is trapped in the drawer, the page behind is inert, and the close button works', async ({ page }) => {
  await page.goto('/work/rexi/');
  await page.locator('[data-claim] [data-evidence-open]').first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog.drawer')), `tab ${i}`).toBe(true);
  }
  await dlg.getByRole('button', { name: /Close/ }).click();
  await expect(dlg).toHaveCount(0);
});

test('drawer works the same under reduced motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/work/rexi/');
  await page.locator('[data-claim] [data-evidence-open]').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await ctx.close();
});

test('MalTrace shows the recorded sample, and its record carries the hash that drives the transition', async ({ page }) => {
  const sha = 'ed01ebfbc9eb5bbea545af4d01bf5f1071661840480439c6e5babe8e080e41aa';
  await page.goto('/work/');
  await expect(page.locator('a.record[data-sig="hash"]')).toHaveAttribute('data-sig-hash', sha);
  await page.goto('/work/maltrace/');
  await expect(page.locator('[data-sig-hash-target]')).toContainText('ed01ebfb…080e41aa');
  const sample = page.getByRole('region', { name: 'Analysed sample' });
  await expect(sample).toContainText(sha);
  await expect(sample).toContainText('3,514,368 bytes');
  // the confidence is labelled as one sample's prediction, never as model accuracy
  const cell = page.locator('[data-claim][data-label="Malicious confidence on this sample"]');
  await expect(cell).toContainText('95%');
  await expect(cell).toHaveAttribute('data-note', /not model accuracy/);
});
