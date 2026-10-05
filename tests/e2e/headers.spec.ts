import { test, expect, type Page } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { instrument } from './helpers';

const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { buildCommand: string; outputDirectory: string; headers: { source: string; headers: { key: string; value: string }[] }[] };
const rule = (source: string) => config.headers.find((r) => r.source === source)!.headers;
const value = (source: string, key: string) => rule(source).find((h) => h.key === key)?.value ?? '';

const check = (file?: string) =>
  spawnSync('npx', ['tsx', 'scripts/check-headers.ts'], { encoding: 'utf8', shell: true, env: { ...process.env, ...(file ? { HEADERS_CONFIG: file } : {}) } });

test('vercel.json sets the deploy command and every security header', () => {
  expect(config.buildCommand).toBe('npm run gate');
  expect(config.outputDirectory).toBe('dist');
  expect(value('/(.*)', 'X-Content-Type-Options')).toBe('nosniff');
  expect(value('/(.*)', 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  const pp = value('/(.*)', 'Permissions-Policy');
  expect(pp).toContain('accelerometer=(self)');
  expect(pp).toContain('gyroscope=(self)');
  expect(pp).toContain('camera=()');
  expect(value('/_astro/(.*)', 'Cache-Control')).toBe('public, max-age=31536000, immutable');
  const csp = value('/(.*)', 'Content-Security-Policy');
  expect(csp).toContain("default-src 'self'");
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
});

test('the CSP hash matches the inline tier script in the built HTML (the checker passes)', () => {
  const r = check();
  expect(r.stderr + r.stdout).toContain('headers: ok');
  expect(r.status).toBe(0);
});

test('the checker fails when the policy is weakened or the hash is stale', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hdr-'));
  const weak = JSON.parse(JSON.stringify(config));
  const h = weak.headers[0].headers.find((x: any) => x.key === 'Content-Security-Policy');
  h.value = h.value.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
  const f1 = join(dir, 'weak.json'); writeFileSync(f1, JSON.stringify(weak));
  const r1 = check(f1);
  expect(r1.status).not.toBe(0);
  expect(r1.stderr).toContain("script-src must not contain 'unsafe-inline'");

  const stale = JSON.parse(JSON.stringify(config));
  const s = stale.headers[0].headers.find((x: any) => x.key === 'Content-Security-Policy');
  s.value = s.value.replace(/'sha256-[^']+'/, "'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='");
  const f2 = join(dir, 'stale.json'); writeFileSync(f2, JSON.stringify(stale));
  const r2 = check(f2);
  expect(r2.status).not.toBe(0);
  expect(r2.stderr).toContain('does not allow an inline script');

  const nosniff = JSON.parse(JSON.stringify(config));
  nosniff.headers[0].headers = nosniff.headers[0].headers.filter((x: any) => x.key !== 'X-Content-Type-Options');
  const f3 = join(dir, 'nosniff.json'); writeFileSync(f3, JSON.stringify(nosniff));
  expect(check(f3).stderr).toContain('X-Content-Type-Options');
});

/** Serve the built site under the real policy from vercel.json, and record every violation the browser reports. */
async function underPolicy(page: Page) {
  const headers: Record<string, string> = {};
  for (const h of rule('/(.*)')) headers[h.key.toLowerCase()] = h.key === 'Content-Security-Policy' ? h.value.replace('; upgrade-insecure-requests', '') : h.value; // http://localhost is the test origin
  await page.route('**/*', async (route) => {
    try {
      const res = await route.fetch();
      await route.fulfill({ response: res, headers: { ...res.headers(), ...headers } });
    } catch { /* the page navigated away while this request was in flight; nothing to fulfil */ }
  });
  await page.addInitScript(() => {
    (window as any).__csp = [];
    addEventListener('securitypolicyviolation', (e) => (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile ?? ''}:${e.lineNumber ?? ''}`));
  });
  const messages: string[] = [];
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) messages.push(m.text()); });
  return { violations: async () => [...(await page.evaluate(() => (window as any).__csp as string[])), ...messages] };
}

test('the whole site runs under the policy with zero violations: hero, transition, scroll story, terminal, status', async ({ page }) => {
  await instrument(page);
  const csp = await underPolicy(page);
  const res = await page.goto('/');
  expect(res!.headers()['content-security-policy']).toContain("script-src 'self' 'sha256-");
  await expect(page.locator('html')).toHaveAttribute('data-scene', 'live', { timeout: 15_000 }); // Three.js / WebGL ran
  await page.mouse.move(600, 300);
  await page.waitForTimeout(500);
  await page.locator('a.record[href="/work/rexi/"]').click(); // waveform transition (overlay uses CSSOM, not inline style)
  await expect(page).toHaveURL(/\/work\/rexi\/$/);
  await page.evaluate(() => scrollTo(0, 900));
  await page.waitForTimeout(500);
  await expect(page.locator('[data-node].is-active').first()).toBeVisible();
  await page.keyboard.press('/');
  await page.getByRole('textbox').fill('cat claims');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('log')).toContainText('rexi-tests'); // fetch('/terminal.json') allowed by connect-src
  await page.keyboard.press('Escape');
  await page.goto('/status/');
  await expect(page.locator('[data-render-panel] .cell-value').first()).toHaveText('A');
  await page.goto('/plain/');
  await page.goto('/nope/');
  expect(await csp.violations(), 'CSP violations').toEqual([]);
});

test('reduced motion also runs clean under the policy', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const csp = await underPolicy(page);
  await page.goto('/');
  await page.goto('/work/rexi/');
  await page.goto('/status/');
  expect(await csp.violations()).toEqual([]);
  await ctx.close();
});

test('the policy actually blocks an injected inline script (so a pass above means something)', async ({ page }) => {
  const csp = await underPolicy(page);
  await page.goto('/about/');
  await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__pwned = 1';
    document.body.append(s);
  });
  expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
  expect((await csp.violations()).join('\n')).toMatch(/script-src/);
});
