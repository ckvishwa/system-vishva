/** Writes src/generated/build.json for the status bar and /logs (ARD §7 ideas 1 & 7). */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const git = (cmd: string) => { try { return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };

const commit = git('rev-parse --short HEAD') || 'local';
const log = (git('log -n 30 --pretty=format:%h|%ad|%s --date=short') || '')
  .split('\n').filter(Boolean)
  .map((l) => { const [hash, date, ...s] = l.split('|'); return { hash, date, subject: s.join('|') }; });

const report = existsSync('src/generated/claims-report.json')
  ? JSON.parse(readFileSync('src/generated/claims-report.json', 'utf8'))
  : { problems: ['claims not checked'] };

mkdirSync('src/generated', { recursive: true });
writeFileSync('src/generated/build.json', JSON.stringify({
  commit,
  date: new Date().toISOString().slice(0, 10),
  gate: report.problems.length === 0 ? 'pass' : 'block', // honest: unverified claims = BLOCK
  log: log.length ? log : [{ hash: commit, date: new Date().toISOString().slice(0, 10), subject: 'Initial scaffold' }],
}, null, 2));
console.log(`manifest: ${commit}, gate ${report.problems.length === 0 ? 'pass' : 'block'}`);
