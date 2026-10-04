/**
 * Runs size-limit, records its JSON for the build manifest (/status, homepage strip) and keeps the
 * normal pass/fail behaviour. The numbers are real measurements of dist/, stamped with when they were taken.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const r = spawnSync('npx', ['size-limit', '--json'], { encoding: 'utf8', shell: true });
let results: Array<{ name: string; passed: boolean; size: number; sizeLimit?: number }> = [];
try { results = JSON.parse(r.stdout); } catch { console.error(r.stdout || r.stderr); process.exit(r.status || 1); }

mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/size.json', JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 2));
for (const x of results) console.log(`${x.passed ? 'pass' : 'FAIL'}  ${(x.size / 1024).toFixed(2)} kB gz  ${x.name}`);
process.exit(results.every((x) => x.passed) ? 0 : 1);
