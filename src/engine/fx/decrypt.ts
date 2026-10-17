/**
 * Decode (meaning: change of state). On first view the characters of any element marked
 * data-fx="decrypt" resolve from random glyphs into the real text, left to right, in at most
 * MAX_MS (override per element with data-fx-ms), once per element. Used on the hero H1, section H2s
 * and the homepage's achievement numbers (decode instead of count-up) — never on body text, never on
 * hover. Runs on the shared scheduler, one subscription for every active run on the page.
 *
 * Accessibility: the element carries aria-label with the real text and the scrambled spans are
 * aria-hidden. Each glyph sits in a span fixed to the width of the character it will become, so the
 * layout never shifts. When it finishes, the original nodes are put back untouched.
 */
import { scheduler } from '../scheduler';
import { onceVisible } from '../input/visibility';
import { cue } from '../cue';

export const GLYPHS = '0123456789ABCDEF─│┌┐└┘├┤┬┴┼';
export const MAX_MS = 500;
const HOLD_MS = 120; // how long the last character keeps scrambling before it resolves

/** Time at which character i of n resolves. Strictly left to right, never later than maxMs.
 *  maxMs is per-call (an element can override MAX_MS via data-fx-ms) so one shared loop still
 *  serves a hero heading and a short metric chip at different settle speeds. */
export const resolveAt = (i: number, n: number, maxMs = MAX_MS) => (n <= 1 ? 0 : (i / (n - 1)) * (maxMs - HOLD_MS)) + HOLD_MS;

export const pick = (rand: () => number = Math.random) => GLYPHS[Math.floor(rand() * GLYPHS.length)];

interface Run { el: HTMLElement; original: Node[]; cells: { span: HTMLElement; ch: string; at: number }[]; t: number; step: number }

/** Width of one character as laid out in the original text (kerning and tracking included). */
function widthOf(node: Text, i: number, range: Range): number {
  range.setStart(node, i);
  range.setEnd(node, i + 1);
  return range.getBoundingClientRect().width;
}

function arm(el: HTMLElement): Run | null {
  const text = el.textContent?.trim();
  if (!text) return null;
  const maxMs = Number(el.dataset.fxMs) || MAX_MS;
  const original = [...el.childNodes];
  const range = document.createRange();
  const total = [...text.replace(/\s/g, '')].length;
  const cells: Run['cells'] = [];
  const frag = document.createDocumentFragment();
  let n = 0;
  for (const node of original) {
    if (node.nodeType !== Node.TEXT_NODE) { frag.append(node.cloneNode(true)); continue; } // keeps <br>
    const data = node.textContent!;
    let i = 0;
    for (const part of data.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(part); i += part.length; continue; }
      const word = document.createElement('span');
      word.setAttribute('aria-hidden', 'true');
      word.style.whiteSpace = 'nowrap'; // words never break mid-glyph
      for (const ch of part) {
        const span = document.createElement('span');
        // clip-path keeps tall box-drawing glyphs inside the cell while scrambling; it is dropped once the real letter lands
        span.style.cssText = `display:inline-block;text-align:center;clip-path:inset(0);width:${widthOf(node as Text, i, range)}px`;
        span.textContent = ch;
        word.append(span);
        cells.push({ span, ch, at: resolveAt(n++, total, maxMs) });
        i += ch.length;
      }
      frag.append(word);
    }
  }
  // <br> reads as a space: "Vishva<br>Teja" is "Vishva Teja", not "VishvaTeja"
  el.setAttribute('aria-label', original.map((n) => (n.nodeName === 'BR' ? ' ' : n.textContent)).join('').replace(/\s+/g, ' ').trim());
  el.replaceChildren(frag);
  return { el, original, cells, t: 0, step: -1 };
}

export function initDecrypt(root: ParentNode = document): () => void {
  const sched = scheduler();
  const runs = new Set<Run>();
  const offs: Array<() => void> = [];

  const finish = (r: Run) => {
    r.el.replaceChildren(...r.original);
    r.el.removeAttribute('aria-label');
    runs.delete(r);
    if (r.el.dataset.fxSound === 'tick') cue('tick'); // "achievement number settles"
  };

  sched.add('decrypt', (dt) => {
    runs.forEach((r) => {
      r.t += dt;
      const scramble = Math.floor(r.t / 50) !== r.step; // new glyphs ~20x a second, not every frame
      r.step = Math.floor(r.t / 50);
      let done = true;
      r.cells.forEach((c) => {
        if (r.t >= c.at) { c.span.textContent = c.ch; c.span.style.clipPath = ''; }
        else { done = false; if (scramble) c.span.textContent = pick(); }
      });
      if (done) finish(r);
    });
    return runs.size > 0;
  });

  root.querySelectorAll<HTMLElement>('[data-fx~="decrypt"]').forEach((h) => {
    offs.push(onceVisible(h, () => {
      const r = arm(h);
      if (!r) return;
      runs.add(r);
      sched.invalidate('decrypt');
      if (h.dataset.fxSound !== 'tick') cue('decode'); // a settling number plays only its own 'tick', not the generic decode texture
      if (h.tagName === 'H2') cue('enter'); // "section becomes active" — a section heading decoding is exactly that moment
    }));
  });

  return () => {
    offs.forEach((f) => f());
    runs.forEach(finish);
    sched.remove('decrypt');
  };
}
