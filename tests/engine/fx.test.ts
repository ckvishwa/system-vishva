import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { buildSync } from 'esbuild';
import { timecode, prompt, coords, createHud } from '../../src/engine/fx/hud';
import { GLYPHS, MAX_MS, resolveAt, pick, initDecrypt } from '../../src/engine/fx/decrypt';
import { depthShift } from '../../src/engine/fx/depth';
import { MAX_SCROLL_FRACTION } from '../../src/engine/fx/parallax';
import { sourceGreeting } from '../../src/engine/fx/console';

describe('HUD (real data only)', () => {
  it('formats the session timecode as HH:MM:SS:FF', () => {
    expect(timecode(0)).toBe('00:00:00:00');
    expect(timecode(61_500)).toBe('00:01:01:15');
    expect(timecode(3_600_000)).toBe('01:00:00:00');
  });
  it('shows the real route as a prompt, never a command', () => {
    expect(prompt('/')).toBe('vishva@system:~$');
    expect(prompt('/work/rexi/')).toBe('vishva@system:~/work/rexi$');
  });
  it('formats pointer coordinates', () => expect(coords(640, 7)).toBe('X 0640  Y 0007'));

  it('writes the DOM only when a value changes', () => {
    document.body.innerHTML = '<div id="h"><i data-hud-prompt></i><i data-hud-time></i><i data-hud-xy></i></div>';
    const root = document.getElementById('h')!;
    const hud = createHud(root, '/work/rexi/');
    const time = root.querySelector('[data-hud-time]')!;
    const writes = vi.fn();
    new MutationObserver(writes).observe(time, { childList: true, characterData: true, subtree: true });
    hud.tick(5000); hud.tick(5000); hud.tick(5000);
    expect(time.textContent).toBe('00:00:05:00');
    return Promise.resolve().then(() => expect(writes).toHaveBeenCalledTimes(1));
  });
  it('shows no coordinates until the pointer has actually moved', () => {
    document.body.innerHTML = '<div id="h"><i data-hud-time></i><i data-hud-xy></i></div>';
    const root = document.getElementById('h')!;
    const hud = createHud(root, '/');
    hud.tick(0);
    expect(root.querySelector('[data-hud-xy]')!.textContent).toBe('');
    hud.setPointer(10, 20); hud.tick(16);
    expect(root.querySelector('[data-hud-xy]')!.textContent).toBe('X 0010  Y 0020');
  });
});

describe('decrypt (E4)', () => {
  it('glyph set is hex plus box drawing: no katakana', () => {
    expect(GLYPHS).toMatch(/^[0-9A-F─│┌┐└┘├┤┬┴┼]+$/);
    expect(GLYPHS).not.toMatch(/[゠-ヿ]/);
    expect(GLYPHS).toContain(pick(() => 0));
  });
  it('resolves strictly left to right and never later than 500 ms', () => {
    const n = 12;
    for (let i = 1; i < n; i++) expect(resolveAt(i, n)).toBeGreaterThan(resolveAt(i - 1, n));
    expect(resolveAt(n - 1, n)).toBeLessThanOrEqual(MAX_MS);
  });

  beforeEach(() => {
    // happy-dom: every element is visible immediately
    (globalThis as any).IntersectionObserver = class { constructor(private cb: any) {} observe(el: Element) { this.cb([{ isIntersecting: true, target: el }]); } disconnect() {} };
    document.body.innerHTML = '<h1 id="t">Vishva<br />Teja</h1>';
  });
  it('keeps the real text for assistive tech, hides the scramble, and restores the DOM when done', async () => {
    const h = document.getElementById('t')!;
    const off = initDecrypt();
    expect(h.getAttribute('aria-label')).toBe('Vishva Teja');
    expect(h.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(h.querySelector('br')).not.toBeNull();
    off(); // cleanup finishes any running effect
    expect(h.getAttribute('aria-label')).toBeNull();
    expect(h.innerHTML).toBe('Vishva<br>Teja');
  });
});

describe('depth (E2)', () => {
  it('never moves more than 15% of the viewport and moves less for nearer depths', () => {
    expect(Math.abs(depthShift(1, 0, 1000))).toBeCloseTo(MAX_SCROLL_FRACTION * 1000);
    expect(Math.abs(depthShift(5, 0, 1000))).toBeLessThanOrEqual(MAX_SCROLL_FRACTION * 1000);
    expect(Math.abs(depthShift(1, 0.5, 1000))).toBeLessThan(Math.abs(depthShift(1, 0, 1000)));
    expect(depthShift(0, 0.5, 1000)).toBeCloseTo(0);
  });
});

describe('console greeting (E8)', () => {
  it('is one message with the mark, the line and the link', () => {
    const log = vi.fn();
    sourceGreeting(log);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("you're reading the source. good.");
    expect(log.mock.calls[0][0]).toContain('https://github.com/ckvishwa');
  });
});

describe('fx budget and rules (ADR-0012)', () => {
  const dir = 'src/engine/fx';
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));

  it('src/engine/fx stays under 4 KB gzipped (minified, outside imports external)', () => {
    const out = buildSync({
      entryPoints: files.map((f) => `${dir}/${f}`),
      bundle: true, minify: true, write: false, format: 'esm', target: 'es2022', splitting: true, outdir: 'out',
      external: ['../scheduler', '../input/*', '../motion/*'],
    });
    const gz = gzipSync(Buffer.concat(out.outputFiles.map((o) => Buffer.from(o.contents)))).length;
    expect(gz, `fx is ${gz} B gzipped`).toBeLessThan(4096);
  });

  it('no effect calls requestAnimationFrame directly', () => {
    for (const f of files) expect(readFileSync(`${dir}/${f}`, 'utf8'), f).not.toMatch(/requestAnimationFrame/);
  });

  it('no effect animates anything but transform, opacity or clip-path', () => {
    for (const f of files) expect(readFileSync(`${dir}/${f}`, 'utf8'), f).not.toMatch(/style\.(left|top|width|height|margin|filter)\s*=/);
  });
});
