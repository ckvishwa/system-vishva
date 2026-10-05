/**
 * Data for the command terminal, generated at build from the content collections and build.json.
 * Nothing in it is typed in by hand: the terminal can only say what the site already knows.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { parse } from 'yaml';
import profileRaw from '../content/profile.yaml?raw';
import { shownStatus } from '../content/lab-status';
import build from '../generated/build.json';
import type { TerminalData } from '../engine/terminal-commands';

const routeOf = (file: string) =>
  file.replace('/src/pages', '').replace(/\.astro$/, '').replace(/index$/, '').replace(/\/?$/, '/') || '/';

export const GET: APIRoute = async () => {
  const routes = Object.keys(import.meta.glob('/src/pages/**/*.astro'))
    .filter((f) => !f.includes('[') && !f.endsWith('/404.astro'))
    .map(routeOf)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));

  const work = (await getCollection('work', (w) => !w.data.draft)).sort((a, b) => a.data.order - b.data.order);
  const claims = await getCollection('claims');
  const lab = (await getCollection('lab')).sort((a, b) => b.data.lastTouched.getTime() - a.data.lastTouched.getTime());
  const rawProfile = parse(profileRaw) as { name: string; facts: { label: string; value: string }[] };
  const profile = { name: rawProfile.name, facts: rawProfile.facts.map((f) => `${f.label}: ${f.value}`) };

  const body: TerminalData = {
    routes,
    projects: work.map((w) => ({ id: w.id, title: w.data.title, category: w.data.category })),
    claims: claims.map((c) => ({ id: c.id, display: c.data.display, label: c.data.label, project: c.data.project, evidence: c.data.evidence, evidenceKind: c.data.evidenceKind })),
    profile,
    status: { commit: build.commit, date: build.date, gate: build.gate, pages: build.pages, gates: build.gates ?? [] },
    lab: lab.map((l) => ({ title: l.data.title, status: shownStatus(l.data.status, l.data.lastTouched), stage: l.data.stage, lastTouched: l.data.lastTouched.toISOString().slice(0, 10) })),
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
