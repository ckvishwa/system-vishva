/**
 * Phase 2: render 1200x630 OG images into public/og/ before every build (see "prebuild"). One for the site
 * (default.png) and one per published case study (work-<id>.png), from the content, never typed in. The files are
 * generated, so they are git-ignored; Base.astro points og:image at them only when the public origin is known.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { renderOg } from './og-lib';

const out = 'public/og';
mkdirSync(out, { recursive: true });

const profile = parse(readFileSync('src/content/profile.yaml', 'utf8')) as { name: string };
const jobs: { file: string; title: string; subtitle: string }[] = [
  { file: 'default.png', title: profile.name, subtitle: 'AI systems, security, reliability' },
];

const dir = 'src/content/work';
for (const f of readdirSync(dir).filter((f) => f.endsWith('.mdx'))) {
  const fm = readFileSync(join(dir, f), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const d = fm ? (parse(fm[1]) as { title: string; category: string; draft?: boolean }) : null;
  if (d && !d.draft) jobs.push({ file: `work-${f.replace(/\.mdx$/, '')}.png`, title: d.title, subtitle: d.category });
}

for (const j of jobs) writeFileSync(join(out, j.file), await renderOg({ title: j.title, subtitle: j.subtitle }));
console.log(`og: ${jobs.length} images in ${out}/`);
