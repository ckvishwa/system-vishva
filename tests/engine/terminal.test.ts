import { describe, it, expect } from 'vitest';
import { run, complete, COMMANDS, resolveTarget, type TerminalData, type Ctx } from '../../src/engine/terminal-commands';

const data: TerminalData = {
  routes: ['/', '/work/', '/lab/', '/status/', '/about/', '/plain/'],
  projects: [{ id: 'rexi', title: 'Rexi', category: 'Voice AI ordering infrastructure' }, { id: 'maltrace', title: 'MalTrace', category: 'Behavioural malware intelligence' }],
  claims: [
    { id: 'rexi-tests', display: '323+', label: 'Automated tests', project: 'rexi', evidence: null },
    { id: 'rexi-evals', display: '71', label: 'Golden evals', project: 'rexi', evidence: 'https://example.com/run/1' },
  ],
  profile: { name: 'Vishva Teja Chikoti', facts: ['A fact.', 'Another fact.'] },
  status: { commit: 'abc1234', date: '2026-10-04', gate: 'block', pages: 12, gates: [
    { id: 'claims', label: 'Claims', status: 'block', value: '1/2', detail: 'verified' },
    { id: 'tests', label: 'Unit tests', status: 'pass', value: '61/61', detail: 'passing', measuredAt: '2026-10-04T10:00:00Z' },
  ] },
  lab: [{ title: 'REVA', status: 'active', stage: 'Memory layer', lastTouched: '2026-10-01' }],
};
const ctx: Ctx = { data, history: ['ls', 'help'], tier: 'A' };
const flat = (r: ReturnType<typeof run>) => r.lines.map((l) => l.map((s) => s.text).join('')).join('\n');
const tones = (r: ReturnType<typeof run>) => r.lines.flat().map((s) => s.tone);

describe('terminal commands', () => {
  it('help lists every command', () => {
    const out = flat(run('help', ctx));
    for (const c of Object.keys(COMMANDS)) expect(out).toContain(c);
    expect(Object.keys(COMMANDS)).toEqual(['help', 'ls', 'open', 'cat', 'whoami', 'status', 'lab', 'mode', 'history', 'clear', 'exit']);
  });
  it('ls shows routes and projects from the data', () => {
    const out = flat(run('ls', ctx));
    expect(out).toContain('/status/');
    expect(out).toContain('rexi');
    expect(out).toContain('Voice AI ordering infrastructure');
  });
  it('open navigates to a project or a route, and rejects the unknown', () => {
    expect(run('open rexi', ctx).action).toEqual({ type: 'navigate', url: '/work/rexi/' });
    expect(run('open status', ctx).action).toEqual({ type: 'navigate', url: '/status/' });
    expect(run('open /work/maltrace/', ctx).action).toEqual({ type: 'navigate', url: '/work/maltrace/' });
    expect(run('open home', ctx).action).toEqual({ type: 'navigate', url: '/' });
    const bad = run('open nope', ctx);
    expect(bad.action).toBeUndefined();
    expect(flat(bad)).toContain('no such route or project: nope');
  });
  it('cat claims marks each claim verified (ok) or UNVERIFIED (risk), straight from the ledger', () => {
    const r = run('cat claims', ctx);
    expect(flat(r)).toContain('UNVERIFIED');
    expect(flat(r)).toContain('verified');
    expect(tones(r)).toContain('risk');
    expect(tones(r)).toContain('ok');
    expect(r.lines).toHaveLength(data.claims.length);
  });
  it('cat claims shows on-request claims as ON REQUEST in info, not red', () => {
    const d2: TerminalData = { ...data, claims: [{ id: 'r', display: '1,020', label: 'Automated tests', project: 'rexi', evidence: null, evidenceKind: 'on-request' }] };
    const r = run('cat claims', { ...ctx, data: d2 });
    expect(flat(r)).toContain('ON REQUEST');
    expect(flat(r)).not.toContain('UNVERIFIED');
    expect(tones(r)).toContain('info');
    expect(tones(r)).not.toContain('risk');
  });
  it('whoami prints only the profile facts', () => expect(flat(run('whoami', ctx))).toBe('Vishva Teja Chikoti\nA fact.\nAnother fact.'));
  it('status shows commit, gate, each check, and the live tier', () => {
    const out = flat(run('status', ctx));
    expect(out).toContain('abc1234');
    expect(out).toContain('BLOCK');
    expect(out).toContain('61/61 passing');
    expect(out).toMatch(/tier\s+A/);
    expect(out).toContain('/status/');
  });
  it('lab prints the process table', () => expect(flat(run('lab', ctx))).toContain('Memory layer'));
  it('mode plain goes to /plain/', () => {
    expect(run('mode plain', ctx).action).toEqual({ type: 'navigate', url: '/plain/' });
    expect(run('mode', ctx).action).toBeUndefined();
  });
  it('history lists previous commands, clear and exit are actions', () => {
    expect(flat(run('history', ctx))).toContain('help');
    expect(run('clear', ctx).action).toEqual({ type: 'clear' });
    expect(run('exit', ctx).action).toEqual({ type: 'exit' });
  });
  it("unknown command: command not found: <x>. try 'help'", () => expect(flat(run('frobnicate now', ctx))).toBe("command not found: frobnicate. try 'help'"));
  it('an empty line prints nothing', () => expect(run('   ', ctx).lines).toEqual([]));
  it('without data it says so rather than inventing output', () => {
    expect(flat(run('status', { ...ctx, data: null }))).toContain('data unavailable');
    expect(flat(run('help', { ...ctx, data: null }))).toContain('help'); // static commands still work
  });
  it('resolveTarget', () => expect(resolveTarget('work/rexi', data)).toBe('/work/rexi/'));
});

describe('tab completion', () => {
  it('completes commands', () => {
    expect(complete('wh', data)).toEqual({ value: 'whoami ', options: [] });
    expect(complete('s', data).value).toBe('status ');
  });
  it('offers the candidates when ambiguous and completes the common prefix', () => {
    const r = complete('c', data);
    expect(r.options).toEqual(['cat', 'clear']);
    expect(r.value).toBe('c');
  });
  it('completes slugs after open, claims after cat, plain after mode', () => {
    expect(complete('open re', data).value).toBe('open rexi ');
    expect(complete('open m', data).value).toBe('open maltrace ');
    expect(complete('cat cl', data).value).toBe('cat claims ');
    expect(complete('mode p', data).value).toBe('mode plain ');
  });
  it('leaves unknown input alone', () => expect(complete('zzz', data)).toEqual({ value: 'zzz', options: [] }));
});
