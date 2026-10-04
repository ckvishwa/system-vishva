/**
 * Security headers check (and updater) for vercel.json. A security portfolio with weak headers is a bad look, so the
 * gate fails if they weaken or drift from the built site.
 *
 *   npx tsx scripts/check-headers.ts          verify vercel.json against dist/  (the gate runs this)
 *   npx tsx scripts/check-headers.ts --write  recompute the CSP hashes from dist/ and rewrite vercel.json
 *
 * The CSP has no 'unsafe-inline' anywhere. The site ships no inline styles and no inline event handlers, and exactly
 * one inline script (the pre-paint tier script in Base.astro), which is allowed by its sha256 hash. This check:
 *   - requires every header below to exist in vercel.json
 *   - hashes every inline <script> in dist/**.html and requires each hash to be in script-src
 *   - requires dist/ to contain no inline <style>, no style="" attributes and no on*="" handlers
 *   - requires script-src to carry no hash that no page uses (a stale hash is a hole)
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const write = process.argv.includes('--write');
const problems: string[] = [];
const fail = (m: string) => problems.push(m);

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const sha = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

if (!existsSync('dist')) { console.error('headers: dist/ not found. Run the build first.'); process.exit(1); }

// ---- what the built site actually contains
const scriptHashes = new Set<string>();
for (const f of walk('dist').filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\ssrc=/.test(m[1])) continue;
    if (/type="(application\/(ld\+)?json|importmap)"/.test(m[1])) continue; // data, not executed
    scriptHashes.add(sha(m[2]));
  }
  if (/<style[\s>]/.test(html)) fail(`${f}: inline <style> found. Styles must be external files (CSP style-src 'self').`);
  if (/\sstyle="/.test(html)) fail(`${f}: inline style="" attribute found. Use a class instead (CSP has no 'unsafe-inline').`);
  if (/\son[a-z]+="/.test(html)) fail(`${f}: inline event handler found. Use addEventListener.`);
}

// ---- the policy
const SELF = "'self'";
const csp = (hashes: string[]) => [
  `default-src ${SELF}`,
  `script-src ${SELF} ${hashes.join(' ')}`.trim(),
  `style-src ${SELF}`,
  `img-src ${SELF} data:`,
  `font-src ${SELF}`,
  `connect-src ${SELF}`,
  `object-src 'none'`,
  `base-uri ${SELF}`,
  `form-action ${SELF}`,
  `frame-ancestors 'none'`,
  'upgrade-insecure-requests',
].join('; ');

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };
const CONFIG = process.env.HEADERS_CONFIG ?? 'vercel.json';
const cfg = JSON.parse(readFileSync(CONFIG, 'utf8')) as { buildCommand?: string; outputDirectory?: string; headers?: Rule[] };
const all = cfg.headers?.find((r) => r.source === '/(.*)');
const get = (k: string) => all?.headers.find((h) => h.key.toLowerCase() === k.toLowerCase())?.value;

if (write) {
  const header = all?.headers.find((h) => h.key === 'Content-Security-Policy');
  if (!header) { console.error('headers: vercel.json has no Content-Security-Policy header to update.'); process.exit(1); }
  header.value = csp([...scriptHashes].sort());
  writeFileSync('vercel.json', JSON.stringify(cfg, null, 2) + '\n');
  console.log(`headers: wrote CSP with ${scriptHashes.size} script hash(es) to vercel.json`);
  process.exit(0);
}

if (cfg.buildCommand !== 'npm run gate') fail(`vercel.json buildCommand must be "npm run gate" (got ${JSON.stringify(cfg.buildCommand)}): deployments must use the gate's output.`);
if (cfg.outputDirectory !== 'dist') fail('vercel.json outputDirectory must be "dist".');
if (!all) fail('vercel.json has no headers rule for "/(.*)".');

const policy = get('Content-Security-Policy');
if (!policy) fail('Content-Security-Policy header is missing.');
else {
  const directive = (name: string) => policy.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `) || d === name);
  for (const must of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"]) {
    if (!policy.split(';').map((d) => d.trim()).includes(must)) fail(`CSP is missing: ${must}`);
  }
  if (/unsafe-eval/.test(policy)) fail("CSP must not contain 'unsafe-eval'.");
  const script = directive('script-src') ?? '';
  const style = directive('style-src') ?? '';
  if (/unsafe-inline/.test(script)) fail("script-src must not contain 'unsafe-inline': allow the inline tier script by hash.");
  if (/unsafe-inline/.test(style)) fail("style-src must not contain 'unsafe-inline': the site has no inline styles.");
  if (!/'self'/.test(script)) fail("script-src must include 'self'.");
  const listed = new Set([...script.matchAll(/'sha256-[A-Za-z0-9+/=]+'/g)].map((m) => m[0]));
  if (scriptHashes.size === 0) fail('dist/ has no inline script, but the CSP is built around the tier script: something changed.');
  for (const h of scriptHashes) if (!listed.has(h)) fail(`CSP script-src does not allow an inline script in dist/ (${h}). The tier script changed: run "npm run csp:update".`);
  for (const h of listed) if (!scriptHashes.has(h)) fail(`CSP script-src lists a hash no page uses (${h}). A stale hash is a hole: run "npm run csp:update".`);
}

const expect = (key: string, test: (v: string) => boolean, why: string) => { const v = get(key); if (!v || !test(v)) fail(`${key}: ${why} (got ${JSON.stringify(v)})`); };
expect('X-Content-Type-Options', (v) => v === 'nosniff', 'must be nosniff');
expect('Referrer-Policy', (v) => v === 'strict-origin-when-cross-origin', 'must be strict-origin-when-cross-origin');
expect('Permissions-Policy', (v) => /accelerometer=\(self\)/.test(v) && /gyroscope=\(self\)/.test(v), 'must allow accelerometer and gyroscope for self only');
expect('Permissions-Policy', (v) => !/(accelerometer|gyroscope)=\([^)]*(\*|https?:)/.test(v), 'accelerometer and gyroscope must not be allowed for other origins');
expect('Strict-Transport-Security', (v) => /max-age=\d{7,}/.test(v), 'must set a long max-age');

const assets = cfg.headers?.find((r) => r.source === '/_astro/(.*)');
const cache = assets?.headers.find((h) => h.key.toLowerCase() === 'cache-control')?.value ?? '';
if (!/max-age=31536000/.test(cache) || !/immutable/.test(cache)) fail(`/_astro/* must be long-cache and immutable (got ${JSON.stringify(cache)}).`);

if (problems.length) {
  console.error('headers: FAIL');
  problems.forEach((p) => console.error(`  ✗ ${p}`));
  process.exit(1);
}
console.log(`headers: ok (CSP covers ${scriptHashes.size} inline script, no inline styles, all security headers present)`);
