/**
 * ARD D-10 / §8 — every metric on the site needs evidence (ADR-0015 defines the kinds).
 *   default:  report, write src/generated/claims-report.json, exit 0 (local dev)
 *   --strict: exit 1 if any claim is unverified or a work page cites an unknown claim (CI gate).
 *             on-request claims are allowed; they are counted separately.
 *   --online: also check every public/self-hosted evidence URL answers 200 anonymously (self-hosted files are
 *             looked up in dist/, so run it after a build). Off for local dev and previews.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { counts, offlineProblems, onlineProblems, type Claim } from './claims-lib';

const strict = process.argv.includes('--strict');
const online = process.argv.includes('--online');

const claims = parse(readFileSync('src/content/claims/claims.yaml', 'utf8')) as Claim[];
const ids = new Set(claims.map((c) => c.id));
const problems: string[] = offlineProblems(claims);

const workDir = 'src/content/work';
for (const f of readdirSync(workDir).filter((f) => f.endsWith('.mdx'))) {
  const fm = readFileSync(join(workDir, f), 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const data = fm ? (parse(fm[1]) as { claimIds?: string[] }) : {};
  for (const id of data.claimIds ?? []) if (!ids.has(id)) problems.push(`missing     ${f} cites unknown claim "${id}"`);
}

if (online) {
  if (!existsSync('dist')) problems.push('online check needs dist/: run it after a build');
  problems.push(...(await onlineProblems(claims, {
    fetch: (url, init) => fetch(url, init),
    distHas: (p) => existsSync(join('dist', p.replace(/^\//, ''))),
  })));
}

const { verified, onRequest, unverified } = counts(claims);
mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/claims-report.json', JSON.stringify({ total: claims.length, verified, onRequest, unverified, problems }, null, 2));

console.log(`claims: ${verified} verified, ${onRequest} on request, ${unverified} unverified, of ${claims.length}${online ? ' (online)' : ''}`);
problems.forEach((p) => console.log(`  ✗ ${p}`));
if (strict && problems.length) { console.error('\nGATE: BLOCK — fix evidence in src/content/claims/claims.yaml'); process.exit(1); }
