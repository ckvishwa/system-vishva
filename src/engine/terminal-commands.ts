/**
 * Terminal commands (ARD §7 idea 10). Pure: a command line and a context in, lines and an optional
 * action out. Every line of output comes from TerminalData (generated at build from the content
 * collections and build.json) or from the live context (history, tier, route). Nothing is invented,
 * nothing is typed out, and there is no fake boot sequence.
 */
export interface TerminalData {
  routes: string[];
  projects: { id: string; title: string; category: string }[];
  claims: { id: string; display: string; label: string; project: string; evidence: string | null; evidenceKind?: 'public' | 'self-hosted' | 'on-request' }[];
  profile: { name: string; facts: string[] };
  status: {
    commit: string; date: string; gate: string; pages: number;
    gates: { id: string; label: string; status: string; value: string; detail: string; measuredAt?: string }[];
  };
  lab: { title: string; status: string; stage: string; lastTouched: string }[];
}

export type Tone = 'cmd' | 'ok' | 'risk' | 'info' | 'muted';
export interface Segment { text: string; tone?: Tone }
export type Line = Segment[];
export type Action = { type: 'navigate'; url: string } | { type: 'clear' } | { type: 'exit' };
export interface Result { lines: Line[]; action?: Action }
export interface Ctx { data: TerminalData | null; history: string[]; tier: string }

export const COMMANDS: Record<string, string> = {
  help: 'list the commands',
  ls: 'routes and projects',
  open: 'open <slug>: go to a project or route',
  cat: 'cat claims: the claims ledger, verified or not',
  whoami: 'the facts on /about',
  status: 'commit, gate, JS size, tests, render tier',
  lab: 'the lab process table',
  mode: 'mode plain: the no-motion page',
  history: 'previous commands',
  clear: 'clear the screen',
  exit: 'close the terminal',
};

const text = (t: string, tone?: Tone): Line => [{ text: t, tone }];
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));
const NO_DATA: Result = { lines: [text('data unavailable: /terminal.json could not be loaded', 'risk')] };
const routeName = (r: string) => (r === '/' ? 'home' : r.replace(/^\/|\/$/g, ''));

/** Everything `open` understands: project slugs and route names. */
export function targets(data: TerminalData): string[] {
  return [...data.projects.map((p) => p.id), ...data.routes.map(routeName)].filter((v, i, a) => a.indexOf(v) === i);
}

export function resolveTarget(arg: string, data: TerminalData): string | null {
  const a = arg.replace(/^\/+|\/+$/g, '');
  if (a === '' || a === 'home') return '/';
  if (data.projects.some((p) => p.id === a)) return `/work/${a}/`;
  const m = /^work\/(.+)$/.exec(a);
  if (m && data.projects.some((p) => p.id === m[1])) return `/work/${m[1]}/`;
  return data.routes.find((r) => routeName(r) === a) ?? null;
}

export function run(input: string, ctx: Ctx): Result {
  const [cmd, ...args] = input.trim().split(/\s+/);
  if (!cmd) return { lines: [] };
  const d = ctx.data;

  switch (cmd) {
    case 'help':
      return { lines: Object.entries(COMMANDS).map(([k, v]): Line => [{ text: pad(k, 9), tone: 'info' }, { text: v }]) };

    case 'ls': {
      if (!d) return NO_DATA;
      return { lines: [
        text('routes', 'muted'), ...d.routes.map((r) => text(`  ${r}`)),
        text('projects', 'muted'), ...d.projects.map((p): Line => [{ text: `  ${pad(p.id, 12)}` }, { text: `${p.title}, ${p.category}`, tone: 'muted' }]),
      ] };
    }

    case 'open': {
      if (!d) return NO_DATA;
      if (!args[0]) return { lines: [text(`usage: open <slug>. try one of: ${targets(d).join(', ')}`, 'muted')] };
      const url = resolveTarget(args[0], d);
      if (!url) return { lines: [text(`open: no such route or project: ${args[0]}`, 'risk')] };
      return { lines: [text(`opening ${url}`, 'muted')], action: { type: 'navigate', url } };
    }

    case 'cat': {
      if (args[0] !== 'claims') return { lines: [text('usage: cat claims', 'muted')] };
      if (!d) return NO_DATA;
      const w = Math.max(...d.claims.map((c) => c.id.length));
      const v = Math.max(...d.claims.map((c) => `${c.display} ${c.label.toLowerCase()}`.length));
      return { lines: d.claims.map((c): Line => [
        { text: `${pad(c.id, w)}  ` },
        { text: `${pad(`${c.display} ${c.label.toLowerCase()}`, v)}  `, tone: 'muted' },
        c.evidence ? { text: 'verified', tone: 'ok' } : c.evidenceKind === 'on-request' ? { text: 'ON REQUEST', tone: 'info' } : { text: 'UNVERIFIED', tone: 'risk' },
        ...(c.evidence ? [{ text: `  ${c.evidence}`, tone: 'muted' as Tone }] : []),
      ]) };
    }

    case 'whoami': {
      if (!d) return NO_DATA;
      return { lines: [text(d.profile.name), ...d.profile.facts.map((f) => text(f, 'muted'))] };
    }

    case 'status': {
      if (!d) return NO_DATA;
      const s = d.status;
      const tone = (st: string): Tone => (st === 'pass' ? 'ok' : 'risk');
      return { lines: [
        [{ text: pad('commit', 8), tone: 'muted' }, { text: `${s.commit}  ${s.date}` }],
        [{ text: pad('gate', 8), tone: 'muted' }, { text: s.gate.toUpperCase(), tone: tone(s.gate) }],
        ...s.gates.map((g): Line => [
          { text: `  ${pad(g.id, 8)}`, tone: 'muted' }, { text: pad(g.status.toUpperCase(), 7), tone: tone(g.status) },
          { text: `${g.value} ${g.detail}${g.measuredAt ? `  (measured ${g.measuredAt.slice(0, 10)})` : ''}` },
        ]),
        [{ text: pad('tier', 8), tone: 'muted' }, { text: `${ctx.tier}  (this visitor, live)` }],
        [{ text: pad('more', 8), tone: 'muted' }, { text: '/status/' }],
      ] };
    }

    case 'lab': {
      if (!d) return NO_DATA;
      const w = Math.max(...d.lab.map((l) => l.title.length));
      return { lines: d.lab.map((l): Line => [
        { text: `${pad(l.title, w)}  ` }, { text: pad(l.status, 9), tone: l.status === 'active' ? 'ok' : 'muted' },
        { text: `${l.stage}  `, tone: 'muted' }, { text: l.lastTouched, tone: 'muted' },
      ]) };
    }

    case 'mode':
      return args[0] === 'plain'
        ? { lines: [text('opening /plain/', 'muted')], action: { type: 'navigate', url: '/plain/' } }
        : { lines: [text('usage: mode plain', 'muted')] };

    case 'history':
      return { lines: ctx.history.map((h, i): Line => [{ text: `${String(i + 1).padStart(3)}  `, tone: 'muted' }, { text: h }]) };

    case 'clear': return { lines: [], action: { type: 'clear' } };
    case 'exit': return { lines: [], action: { type: 'exit' } };

    default:
      return { lines: [text(`command not found: ${cmd}. try 'help'`, 'risk')] };
  }
}

const lcp = (xs: string[]) => xs.reduce((a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return a.slice(0, i); });

/** Tab completion for commands and slugs. `options` lists the candidates when the choice is ambiguous. */
export function complete(input: string, data: TerminalData | null): { value: string; options: string[] } {
  const parts = input.split(/\s+/);
  const last = parts[parts.length - 1];
  let pool: string[];
  if (parts.length === 1) pool = Object.keys(COMMANDS);
  else if (parts[0] === 'open' && data) pool = targets(data);
  else if (parts[0] === 'cat') pool = ['claims'];
  else if (parts[0] === 'mode') pool = ['plain'];
  else return { value: input, options: [] };

  const hits = pool.filter((p) => p.startsWith(last));
  if (!hits.length) return { value: input, options: [] };
  const head = parts.slice(0, -1).join(' ');
  const join = (w: string) => (head ? `${head} ${w}` : w);
  if (hits.length === 1) return { value: `${join(hits[0])} `, options: [] };
  return { value: join(lcp(hits)), options: hits };
}
