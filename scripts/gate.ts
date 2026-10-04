/**
 * `npm run gate`: the release gate, and the ONLY command a deployment should build with (vercel.json uses it).
 *
 *   1. claims   every metric needs evidence (strict, see below)
 *   2. tests    unit tests, writing src/generated/tests.json
 *   3. build    astro build (the manifest picks up the test results)
 *   4. size     size-limit budgets, writing src/generated/size.json
 *   5. build    SECOND build, on purpose: the first build could not know the size numbers (they exist only
 *               after a build), so this one bakes the real figures into /status and the homepage strip.
 *               What ships is always this second build's output.
 *   6. headers  vercel.json security headers exist and the CSP hashes match the built HTML
 *
 * Claims are strict everywhere except Vercel preview deployments (VERCEL_ENV=preview): a preview of work in
 * progress still deploys so it can be tested on a phone, and it shows BLOCK on /status honestly. Production
 * and CI stay strict, so unverified claims can never ship to the real domain.
 */
import { spawnSync } from 'node:child_process';

const preview = process.env.VERCEL_ENV === 'preview';
const steps: Array<[string, string]> = [
  ['claims', `npx tsx scripts/verify-claims.ts${preview ? '' : ' --strict'}`],
  ['tests', 'npm run test:report'],
  ['build', 'npm run build'],
  ['size', 'npm run size:report'],
  ['build (final, with measured sizes)', 'npm run build'],
  ['headers', 'npm run check:headers'],
];

if (preview) console.log('gate: Vercel preview, so claims are advisory (production stays strict)\n');
for (const [name, cmd] of steps) {
  console.log(`\n=== gate: ${name}`);
  const r = spawnSync(cmd, { stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\nGATE: BLOCK at "${name}"`);
    process.exit(r.status ?? 1);
  }
}
console.log('\nGATE: PASS');
