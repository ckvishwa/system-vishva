/**
 * Build-time integrity check for the MalTrace teardown (ADR-0016). Parses both artifacts with their zod schemas and
 * cross-checks them against maltrace.mdx and claims.yaml. Any malformed file or disagreement exits 1, so a wrong or
 * stale number cannot ship. Runs in `prebuild`.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { shapSchema, teardownSchema, teardownProblems } from '../src/content/teardown';

const dir = 'src/content/work/maltrace';
const json = (f: string) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));

const problems: string[] = [];
const t = teardownSchema.safeParse(json('maltrace-teardown.json'));
const s = shapSchema.safeParse(json('shap_wannacry_exe.json'));
if (!t.success) problems.push(`maltrace-teardown.json is malformed: ${t.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
if (!s.success) problems.push(`shap_wannacry_exe.json is malformed: ${s.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);

if (t.success && s.success) {
  const mdx = readFileSync('src/content/work/maltrace.mdx', 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm = mdx ? (parse(mdx[1]) as { sample?: any }) : {};
  const claims = Object.fromEntries((parse(readFileSync('src/content/claims/claims.yaml', 'utf8')) as { id: string; value: number }[]).map((c) => [c.id, c.value]));
  problems.push(...teardownProblems({ teardown: t.data, shap: s.data, sample: fm.sample, claims, staticFeatures: json('maltrace-features.json').static }));
}

if (problems.length) {
  problems.forEach((p) => console.error(`  ✗ teardown: ${p}`));
  console.error('\nTEARDOWN: BLOCK — the MalTrace teardown inputs are malformed or disagree');
  process.exit(1);
}
console.log('teardown: inputs valid and consistent');
