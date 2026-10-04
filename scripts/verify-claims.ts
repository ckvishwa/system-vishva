/**
 * ARD D-10 / §8 — every metric on the site needs evidence.
 *   default:  report, write src/generated/claims-report.json, exit 0 (local dev)
 *   --strict: exit 1 if any claim lacks evidence or a work page cites an unknown claim (CI gate)
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const strict = process.argv.includes('--strict');
type Claim = { id: string; label: string; display: string; evidence: string | null };

const claims = parse(readFileSync('src/content/claims/claims.yaml', 'utf8')) as Claim[];
const ids = new Set(claims.map((c) => c.id));
const problems: string[] = [];

for (const c of claims) if (!c.evidence) problems.push(`unverified  ${c.id} (${c.display} ${c.label})`);

const workDir = 'src/content/work';
for (const f of readdirSync(workDir).filter((f) => f.endsWith('.mdx'))) {
  const fm = readFileSync(join(workDir, f), 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const data = fm ? (parse(fm[1]) as { claimIds?: string[] }) : {};
  for (const id of data.claimIds ?? []) if (!ids.has(id)) problems.push(`missing     ${f} cites unknown claim "${id}"`);
}

const verified = claims.length - claims.filter((c) => !c.evidence).length;
mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/claims-report.json', JSON.stringify({ total: claims.length, verified, problems }, null, 2));

console.log(`claims: ${verified}/${claims.length} verified`);
problems.forEach((p) => console.log(`  ✗ ${p}`));
if (strict && problems.length) { console.error('\nGATE: BLOCK — add evidence links in src/content/claims/claims.yaml'); process.exit(1); }
