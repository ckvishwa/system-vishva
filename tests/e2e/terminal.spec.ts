import { test, expect, type Page } from '@playwright/test';
import { instrument } from './helpers';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Terminal' });
const input = (page: Page) => dialog(page).getByRole('textbox');
const type = async (page: Page, cmd: string) => { await input(page).fill(cmd); await input(page).press('Enter'); };
const log = (page: Page) => dialog(page).getByRole('log');

test('"/" opens the terminal with focus in the prompt; the terminal chunk loads only then', async ({ page }) => {
  const chunks: string[] = [];
  page.on('request', (r) => { if (/\/_astro\/terminal\.[^/]+\.js$/.test(r.url()) || r.url().endsWith('/terminal.json')) chunks.push(r.url()); });
  await page.goto('/');
  await page.waitForTimeout(500);
  expect(chunks, 'nothing terminal-related before the first open').toEqual([]);
  await page.keyboard.press('/');
  await expect(dialog(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  expect(chunks.length).toBeGreaterThan(0);
  await expect(dialog(page)).toHaveAttribute('aria-modal', 'true');
  await expect(log(page)).toHaveAttribute('aria-live', 'polite');
});

test('the backtick also opens it, and "/" typed inside the prompt is just a character', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('`');
  await expect(dialog(page)).toBeVisible();
  await input(page).pressSequentially('open /work');
  await expect(input(page)).toHaveValue('open /work');
  await expect(dialog(page)).toHaveCount(1);
});

test('help lists the commands', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('/');
  await type(page, 'help');
  for (const c of ['help', 'ls', 'open', 'cat', 'whoami', 'status', 'lab', 'mode', 'history', 'clear', 'exit']) {
    await expect(log(page)).toContainText(c);
  }
});

test('open rexi navigates through the router and closes the terminal', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { (window as any).__marker = 'same-document'; });
  await page.keyboard.press('/');
  await type(page, 'open rexi');
  await expect(page).toHaveURL(/\/work\/rexi\/$/);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Rexi');
  expect(await page.evaluate(() => (window as any).__marker)).toBe('same-document'); // router, not a reload
});

test('Esc closes it and returns focus to what opened it', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Terminal' });
  await opener.focus();
  await opener.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('an unknown command shows the exact error', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('/');
  await type(page, 'frobnicate');
  await expect(log(page)).toContainText("command not found: frobnicate. try 'help'");
});

test('every output comes from real data: cat claims, status, ls, whoami, lab', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('/');
  await type(page, 'cat claims');
  await expect(log(page).locator('.t-risk', { hasText: 'UNVERIFIED' })).toHaveCount(6);
  await expect(log(page)).toContainText('rexi-tests');
  await type(page, 'status');
  await expect(log(page)).toContainText('gate');
  await expect(log(page)).toContainText('BLOCK');
  await expect(log(page)).toContainText('/status/');
  await type(page, 'ls');
  await expect(log(page)).toContainText('/status/');
  await expect(log(page)).toContainText('maltrace');
  await type(page, 'whoami');
  await expect(log(page)).toContainText('Vishva Teja Chikoti');
  await expect(log(page)).toContainText('CompTIA Security+');
  await type(page, 'lab');
  await expect(log(page)).toContainText('REVA');
});

test('the status command reports the live render tier', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }); Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 }); });
  await page.goto('/');
  await page.keyboard.press('/');
  await type(page, 'status');
  await expect(log(page)).toContainText(/tier\s+A/);
});

test('the prompt shows the real route', async ({ page }) => {
  await page.goto('/work/rexi/');
  await page.keyboard.press('/');
  await expect(dialog(page).locator('label')).toHaveText('vishva@system:~/work/rexi$');
});

test('tab completes commands and slugs; arrows walk the history', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('/');
  await input(page).fill('who');
  await input(page).press('Tab');
  await expect(input(page)).toHaveValue('whoami ');
  await input(page).fill('open mal');
  await input(page).press('Tab');
  await expect(input(page)).toHaveValue('open maltrace ');
  await input(page).fill('');
  await type(page, 'ls');
  await type(page, 'lab');
  await input(page).press('ArrowUp');
  await expect(input(page)).toHaveValue('lab');
  await input(page).press('ArrowUp');
  await expect(input(page)).toHaveValue('ls');
  await input(page).press('ArrowDown');
  await expect(input(page)).toHaveValue('lab');
  await type(page, 'history');
  await expect(log(page)).toContainText('ls');
});

test('clear empties the screen, exit closes it', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('/');
  await type(page, 'help');
  await type(page, 'clear');
  await expect(log(page).locator('.t-line')).toHaveCount(0);
  await type(page, 'exit');
  await expect(dialog(page)).toHaveCount(0);
});

test('focus is trapped in the dialog and the page behind is inert', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('/');
  await expect(input(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog(page).getByRole('button', { name: /Close/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog(page).getByRole('button', { name: /Close/ })).toBeFocused();
  expect(await page.evaluate(() => (document.querySelector('main') as HTMLElement).inert)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (document.querySelector('main') as HTMLElement).inert)).toBe(false);
});

test('the terminal adds no frame loop: idle after opening renders 0 frames', async ({ page }) => {
  await instrument(page);
  await page.goto('/work/rexi/'); // no hero loop here, so any frame would be the terminal's
  await page.waitForTimeout(1500);
  await page.keyboard.press('/');
  await type(page, 'help');
  await page.waitForTimeout(1500);
  await page.evaluate(() => { (window as any).__frames = 0; });
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).__frames)).toBe(0);
});

test('mobile: the nav item opens it full-screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Terminal' }).tap();
  await expect(dialog(page)).toBeVisible();
  const box = await dialog(page).boundingBox();
  expect(Math.round(box!.height)).toBe(844);
  await type(page, 'mode plain');
  await expect(page).toHaveURL(/\/plain\/$/);
  await ctx.close();
});

test('reduced motion: works the same, instantly', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.keyboard.press('/');
  await type(page, 'help');
  await expect(log(page)).toContainText('whoami');
  await ctx.close();
});
