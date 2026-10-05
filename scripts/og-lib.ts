/**
 * Open Graph images, drawn at build time (Phase 2). 1200x630, the page background, the title bottom-left under a single
 * 4px rule. No gradient, no glow, no decoration. Colours are read from src/styles/tokens.css, never typed here.
 *
 * Text is converted to vector paths with the site's own fonts (fontkitten), then rasterised by sharp. That keeps the
 * output identical on every machine: it never depends on which fonts a CI runner happens to have installed.
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { create } from 'fontkitten';

export const OG_W = 1200;
export const OG_H = 630;
const PAD = 64;
const RULE = 4;

type Font = ReturnType<typeof create>;
const load = (p: string): Font => create(readFileSync(p));
const fonts = {
  sans: () => load('node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2'),
  mono: () => load('node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2'),
};

export function token(name: string, css = readFileSync('src/styles/tokens.css', 'utf8')): string {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`token --${name} not found in tokens.css`);
  return m[1].trim();
}

const width = (f: Font, text: string, size: number) => {
  let w = 0;
  for (const ch of text) w += (f.glyphForCodePoint(ch.codePointAt(0)!).advanceWidth * size) / f.unitsPerEm;
  return w;
};

/** Greedy word wrap to a pixel width. A single word wider than the width stays on its own line. */
export function wrap(f: Font, text: string, size: number, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(f, next, size) > max) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** One line of text as an SVG path, its baseline at (x, y). */
function textPath(f: Font, text: string, size: number, x: number, y: number, fill: string): string {
  const k = size / f.unitsPerEm;
  let pen = 0;
  const d: string[] = [];
  for (const ch of text) {
    const g = f.glyphForCodePoint(ch.codePointAt(0)!);
    d.push(g.path.toSVG ? g.path.translate(pen, 0).toSVG() : '');
    pen += g.advanceWidth;
  }
  return `<path fill="${fill}" transform="translate(${x} ${y}) scale(${k} ${-k})" d="${d.join('')}"/>`;
}

export interface OgInput { title: string; subtitle?: string }

export function ogSvg({ title, subtitle }: OgInput): string {
  const bg = token('c-bg'), fg = token('c-text'), muted = token('c-muted');
  const sans = fonts.sans(), mono = fonts.mono();
  const size = 88, lead = 100, subSize = 26;
  const lines = wrap(sans, title, size, OG_W - PAD * 2).slice(0, 3);

  const bottom = OG_H - PAD;
  const subY = subtitle ? bottom : null;
  const lastBase = subtitle ? bottom - subSize - 36 : bottom;
  const firstBase = lastBase - lead * (lines.length - 1);
  const ruleY = firstBase - size - 36;

  const parts = [
    `<rect width="${OG_W}" height="${OG_H}" fill="${bg}"/>`,
    `<rect x="${PAD}" y="${ruleY}" width="${OG_W - PAD * 2}" height="${RULE}" fill="${fg}"/>`,
    ...lines.map((l, i) => textPath(sans, l, size, PAD, firstBase + i * lead, fg)),
    ...(subtitle && subY !== null ? [textPath(mono, subtitle, subSize, PAD, subY, muted)] : []),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">${parts.join('')}</svg>`;
}

export async function renderOg(input: OgInput): Promise<Buffer> {
  return sharp(Buffer.from(ogSvg(input))).png().toBuffer();
}
