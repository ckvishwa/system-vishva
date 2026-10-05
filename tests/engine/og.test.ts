import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { ogSvg, renderOg, token, OG_W, OG_H } from '../../scripts/og-lib';

// Parse "#rrggbb" from a token into [r, g, b] (the test reads tokens.css, so it never hard-codes a colour either).
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const px = async (img: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(img).raw().toBuffer({ resolveWithObject: true });
  const o = (y * info.width + x) * info.channels;
  return [data[o], data[o + 1], data[o + 2]];
};

describe('og image', () => {
  it('is 1200x630', async () => {
    const m = await sharp(await renderOg({ title: 'QualityMesh', subtitle: 'Release assurance infrastructure' })).metadata();
    expect([m.width, m.height, m.format]).toEqual([1200, 630, 'png']);
    expect([OG_W, OG_H]).toEqual([1200, 630]);
  });

  it('uses the page background, a 4px rule and the title bottom-left; the top is empty', async () => {
    const img = await renderOg({ title: 'MalTrace', subtitle: 'Behavioural malware intelligence' });
    const bg = rgb(token('c-bg')), fg = rgb(token('c-text'));
    expect(await px(img, 1100, 20)).toEqual(bg);   // top right: nothing
    expect(await px(img, 600, 100)).toEqual(bg);   // upper middle: nothing

    // the single rule: find rows (at x=600) that are the text colour; there must be exactly 4, contiguous
    const rows: number[] = [];
    for (let y = 0; y < OG_H; y++) if ((await px(img, 600, y)).every((v, i) => v === fg[i])) rows.push(y);
    expect(rows).toHaveLength(4);
    expect(rows[3] - rows[0]).toBe(3);

    // the title sits below the rule, in the left half, in the lower half of the image
    const { data, info } = await sharp(img).raw().toBuffer({ resolveWithObject: true });
    let minX = info.width, minY = info.height;
    for (let y = rows[3] + 2; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const o = (y * info.width + x) * info.channels;
      if (data[o] !== bg[0] || data[o + 1] !== bg[1] || data[o + 2] !== bg[2]) { minX = Math.min(minX, x); minY = Math.min(minY, y); }
    }
    expect(minX).toBeGreaterThanOrEqual(60);
    expect(minX).toBeLessThan(120);
    expect(minY).toBeGreaterThan(OG_H / 2);
  });

  it('uses only token colours: every fill in the svg comes from tokens.css', () => {
    const svg = ogSvg({ title: 'Vishva Teja Chikoti', subtitle: 'AI systems, security, reliability' });
    const allowed = new Set([token('c-bg'), token('c-text'), token('c-muted')]);
    const fills = [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1]);
    expect(fills.length).toBeGreaterThan(0);
    fills.forEach((f) => expect(allowed.has(f), f).toBe(true));
    expect(svg).not.toMatch(/gradient|filter|blur/i);
  });

  it('wraps a long title to at most three lines', () => {
    const svg = ogSvg({ title: 'A very long title that keeps going and going well past one line of the card at this size' });
    expect((svg.match(/<path /g) ?? []).length).toBeLessThanOrEqual(3);
  });

  it('og-lib.ts contains no hex colour literal', () => {
    expect(readFileSync('scripts/og-lib.ts', 'utf8')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
