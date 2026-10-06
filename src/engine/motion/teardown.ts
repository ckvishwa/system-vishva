/**
 * MalTrace teardown stage (ADR-0016). Lazy-loaded by components/case/Teardown.astro on tier A/B only.
 * It reads the static document that component rendered (data-td-* attributes), builds an aria-hidden sticky stage from it,
 * and on each scroll or resize maps progress through engine/motion/teardown-state.ts onto the stage: transform, opacity and
 * clip-path only. Input is input/scroll.ts, the frame is the shared scheduler, which sleeps again straight away, so a page
 * that has stopped scrolling renders 0 frames. DOM only: no WebGL, no animation library, no loop of its own.
 * A missing piece of data means that layer is not built.
 */
import { scheduler } from '../scheduler';
import { trackScroll, trackViewport } from '../input/scroll';
import { teardownState, stageProgress, slabHeights, barLengths, STATES, type Layers } from './teardown-state';

type R = { x: number; y: number; w: number; h: number };
type Geo = { W: number; H: number; mobile: boolean; pad: number; slabs: R; side: R; main: R };
type Layer = { place(g: Geo): void; apply(l: Layers): void };

const ID = 'teardown';
const num = new Intl.NumberFormat('en-US');
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const tr = (e: HTMLElement, x: number, y: number, s = 1) => { e.style.transform = `translate(${x}px,${y}px)${s === 1 ? '' : ` scale(${s})`}`; };
const box = (e: HTMLElement, w: number, h?: number) => { e.style.width = `${w}px`; if (h !== undefined) e.style.height = `${h}px`; };
const el = (tag: string, cls: string, text?: string, parent?: Element) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.append(e);
  return e;
};

export function initTeardown(root: HTMLElement): () => void {
  const all = <T extends HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)];
  const one = (s: string) => root.querySelector<HTMLElement>(s);

  // ---- read the static document (the single source of everything shown)
  const file = one('[data-td-file]');
  const secs = all('[data-td-sec]').map((e) => ({ name: e.dataset.name!, size: +e.dataset.size!, ent: +e.dataset.entropy!, note: e.dataset.note }));
  const apis = all('[data-td-api]').map((e) => ({ name: e.dataset.name!, count: +e.dataset.count! }));
  const total = one('[data-td-total]') ? +one('[data-td-total]')!.dataset.value! : null;
  const statics = all('[data-td-static]').map((e) => e.dataset.name!);
  const dyn = +(root.dataset.dynamic ?? 0), stat = +(root.dataset.static ?? 0);
  const verdict = one('[data-td-verdict]')?.textContent ?? '';
  const sub = one('[data-td-sub]')?.textContent ?? '';
  const shap = all('[data-td-shap]').map((e) => ({ name: e.dataset.name!, v: +e.dataset.impact!, dir: e.dataset.dir }));
  const tags = all<HTMLAnchorElement>('[data-td-attack]').map((a) => ({ id: a.textContent!, href: a.href }));

  // ---- build the stage
  const track = el('div', 'td-track');
  const stage = el('div', 'td-stage', undefined, track);
  stage.setAttribute('aria-hidden', 'true');
  const headEl = el('p', 'td-head mono', '', stage);
  const title = file ? el('p', 'td-title mono', `${file.dataset.name} · ${num.format(+file.dataset.size!)} bytes`, stage) : null;
  const hash = file ? el('p', 'td-sha mono muted', file.dataset.sha, stage) : null;
  const layer = () => el('div', 'td-layer', undefined, stage);
  const layers: Layer[] = [];

  if (secs.length) {
    const g = layer();
    const slabs = secs.map((s) => {
      const e = el('div', 'td-slab', undefined, g);
      const fill = el('i', 'td-fill', undefined, e);
      fill.style.opacity = String(Math.min(1, s.ent / 8) * 0.3); // fill density follows entropy
      const lab = el('p', 'td-lab mono', `${s.name} · ${num.format(s.size)} bytes\nentropy ${s.ent.toFixed(2)}${s.note ? ` · ${s.note}` : ''}`, g);
      return { e, lab, h: 0, y: 0 };
    });
    let gx = 0, gp = 0, gw = 0;
    layers.push({
      place(geo) {
        const r = geo.slabs, hs = slabHeights(secs.map((s) => s.size), r.h * (geo.mobile ? 0.5 : 0.6), 8);
        gw = geo.mobile ? r.w : Math.min(r.w, 300);
        gx = r.x;
        gp = (r.h - hs.reduce((a, b) => a + b, 0)) / Math.max(1, slabs.length - 1);
        let y = r.y;
        slabs.forEach((s, i) => { s.h = hs[i]; s.y = y; y += hs[i]; box(s.e, gw, hs[i]); box(s.lab, geo.mobile ? gw : r.w - gw - 12); });
        slabs.forEach((s) => { s.lab.dataset.m = geo.mobile ? '1' : ''; });
      },
      apply(l) {
        g.style.opacity = String(l.slabs.opacity);
        slabs.forEach((s, i) => {
          const y = s.y + l.slabs.gap * gp * i, m = s.lab.dataset.m;
          tr(s.e, gx, y);
          tr(s.lab, m ? gx : gx + gw + 12, m ? y + s.h + 2 : y + Math.max(0, (s.h - 14) / 2));
          s.lab.style.opacity = String(l.slabs.labels);
        });
      },
    });
  }

  if (apis.length) {
    const g = layer();
    const counts = barLengths(apis.map((a) => a.count));
    const totalEl = total !== null ? el('p', 'td-total mono', '', g) : null;
    const rows = apis.map((a) => ({ name: el('p', 'td-api mono', `${a.name} ${num.format(a.count)}`, g), bar: el('i', 'td-bar', undefined, g) }));
    let rh = 0;
    layers.push({
      place(geo) {
        const r = geo.side;
        rh = Math.min(30, (r.h - 36) / rows.length);
        if (totalEl) { box(totalEl, r.w); tr(totalEl, r.x, r.y); }
        rows.forEach((o, i) => { box(o.name, r.w); box(o.bar, r.w, 3); tr(o.name, r.x, r.y + 36 + i * rh); });
      },
      apply(l) {
        g.style.opacity = String(l.stream.opacity);
        if (totalEl) totalEl.textContent = `${num.format(Math.round(total! * l.stream.total))} API calls`;
        rows.forEach((o, i) => {
          const s = clamp(l.stream.bars * 1.5 - i / (rows.length * 2)) * counts[i];
          o.bar.style.transform = `translate(${rootRect.side.x}px,${rootRect.side.y + 36 + i * rh + Math.min(16, rh - 4)}px) scaleX(${s})`;
        });
      },
    });
  }

  const cellCount = dyn + stat;
  const cells = cellCount ? Array.from({ length: cellCount }, (_, i) => ({ e: null as HTMLElement | null, i })) : [];
  if (cells.length) {
    const g = layer();
    cells.forEach((c) => { c.e = el('i', `td-cell${c.i >= dyn ? ' is-static' : ''}`, undefined, g); if (c.i >= dyn) c.e.title = statics[c.i - dyn] ?? ''; });
    const lab1 = el('p', 'td-lab mono', `${dyn} dynamic behavioral`, g);
    const lab2 = el('p', 'td-lab mono info', `${stat} static PE`, g);
    const mdl = el('p', 'td-model mono', root.dataset.model ?? 'model', stage);
    let pos: [number, number][] = [], from: [number, number][] = [], mid: [number, number] = [0, 0];
    layers.push({
      place(geo) {
        const r = geo.main, cols = geo.mobile ? 8 : 12, size = Math.min(26, (r.w - 8) / cols - 4), step = size + 4;
        const x0 = r.x + (r.w - cols * step) / 2, rows = Math.ceil(dyn / cols);
        pos = cells.map((c) => c.i < dyn ? [x0 + (c.i % cols) * step, r.y + 24 + Math.floor(c.i / cols) * step] : [x0 + ((c.i - dyn) % cols) * step, r.y + 48 + (rows + Math.floor((c.i - dyn) / cols)) * step]);
        from = cells.map((c) => [geo.side.x + ((c.i * 37) % geo.side.w), geo.side.y + ((c.i * 53) % geo.side.h)]);
        mid = [r.x + r.w / 2 - size / 2, r.y + r.h * 0.3 - size / 2];
        cells.forEach((c) => box(c.e!, size, size));
        box(lab1, r.w); box(lab2, r.w);
        tr(lab1, r.x, r.y); tr(lab2, r.x, r.y + 24 + rows * step);
        box(mdl, 200, 56); tr(mdl, r.x + r.w / 2 - 100, r.y + r.h * 0.3 - 28);
      },
      apply(l) {
        g.style.opacity = String(l.grid.opacity);
        mdl.style.opacity = String(l.model.opacity);
        cells.forEach((c) => {
          const [px, py] = pos[c.i], [fx, fy] = from[c.i];
          const x = lerp(lerp(fx, px, l.grid.assemble), mid[0], l.grid.converge), y = lerp(lerp(fy, py, l.grid.assemble), mid[1], l.grid.converge);
          tr(c.e!, x, y, lerp(1, 0.3, l.grid.converge));
        });
      },
    });
  }

  if (verdict) {
    const g = layer();
    const blk = el('p', 'td-verdict', verdict, g);
    const bar = el('i', 'td-redact', undefined, g);
    const note = el('p', 'td-lab mono muted', sub, g);
    let c: [number, number] = [0, 0], d: [number, number] = [0, 0], w = 0;
    layers.push({
      place(geo) {
        const r = geo.main;
        w = Math.min(r.w, 560);
        c = [r.x + (r.w - w) / 2, r.y + r.h * 0.55];
        d = [geo.pad, 88];
        [blk, bar].forEach((e) => box(e, w, 56));
        box(note, w);
      },
      apply(l) {
        const v = l.verdict, s = lerp(1, 0.7, v.dock), x = lerp(c[0], d[0], v.dock), y = lerp(c[1], d[1], v.dock);
        g.style.opacity = String(v.opacity);
        tr(blk, x, y, s); tr(bar, x, y, s); tr(note, x, y + 56 * s + 4);
        bar.style.clipPath = `inset(0 0 0 ${v.reveal * 100}%)`; // the redaction wipes away as it is revealed
        blk.setAttribute('data-docked', v.dock > 0.5 ? '1' : '');
      },
    });
  }

  if (shap.length) {
    const g = layer();
    const len = barLengths(shap.map((s) => s.v));
    const rows = shap.map((s) => ({ s, lab: el('p', 'td-lab mono', `${s.name} ${s.v > 0 ? '+' : ''}${s.v}`, g), bar: el('i', `td-push ${s.v > 0 ? 'is-risk' : 'is-ok'}`, undefined, g) }));
    const cap = el('p', 'td-lab mono muted', `← away from malicious · toward malicious →${root.dataset.base ? `\nSHAP base value ${root.dataset.base}` : ''}`, g);
    let ax = 0, half = 0, y0 = 0, rh = 0, off = 4;
    layers.push({
      place(geo) {
        const r = geo.main, lw = geo.mobile ? r.w : Math.min(230, r.w * 0.42);
        half = (r.w - (geo.mobile ? 0 : lw)) / 2; ax = r.x + (geo.mobile ? 0 : lw) + half; y0 = r.y + 84; rh = Math.min(geo.mobile ? 40 : 30, (r.h - 84) / rows.length);
        off = geo.mobile ? 18 : 4;
        box(cap, r.w); tr(cap, r.x, r.y + 40);
        rows.forEach((o, i) => { box(o.lab, lw); box(o.bar, half, 8); tr(o.lab, r.x, y0 + i * rh); });
      },
      apply(l) {
        g.style.opacity = String(l.explain.opacity);
        rows.forEach((o, i) => {
          const s = len[i] * l.explain.bars, left = o.s.v < 0;
          o.bar.style.transformOrigin = left ? 'right center' : 'left center';
          o.bar.style.transform = `translate(${left ? ax - half : ax}px,${y0 + i * rh + off}px) scaleX(${s})`;
        });
      },
    });
  }

  if (tags.length) {
    const g = layer();
    const els = tags.map((t) => { const a = el('a', 'td-tag mono', t.id, g) as HTMLAnchorElement; a.href = t.href; a.tabIndex = -1; a.target = '_blank'; a.rel = 'noopener'; return a; });
    let pts: [number, number][] = [];
    layers.push({
      place(geo) {
        const r = geo.main, cw = 104, cols = Math.max(1, Math.floor(r.w / cw));
        pts = els.map((_, i) => [r.x + (i % cols) * cw, r.y + 64 + Math.floor(i / cols) * 40]);
        els.forEach((a) => box(a, cw - 8));
      },
      apply(l) {
        g.style.opacity = String(l.map.opacity);
        els.forEach((a, i) => { const o = clamp(l.map.locked * els.length - i); a.style.opacity = String(o); tr(a, pts[i][0], pts[i][1] + (1 - o) * 8); });
      },
    });
  }

  // ---- geometry
  const rootRect = { side: { x: 0, y: 0, w: 0, h: 0 } };
  let geo: Geo, last: Layers = teardownState(0), shown = -1;
  const measure = () => {
    const W = stage.clientWidth, H = stage.clientHeight, mobile = W < 720, pad = mobile ? 16 : 24;
    const full = { x: pad, w: W - pad * 2 };
    geo = {
      W, H, mobile, pad,
      slabs: mobile ? { ...full, y: 120, h: H * 0.42 } : { x: pad, y: 120, w: W * 0.5 - pad, h: H - 200 },
      side: mobile ? { ...full, y: 120 + H * 0.42 + 24, h: H - 120 - H * 0.42 - 80 } : { x: W * 0.5, y: 120, w: W * 0.5 - pad, h: H - 200 },
      main: { ...full, y: mobile ? 172 : 120, h: H - (mobile ? 252 : 200) }, // mobile leaves room for the docked verdict's two lines
    };
    rootRect.side = geo.side;
    if (title) { box(title, W - pad * 2); tr(title, pad, pad + 40); }
    if (hash) { box(hash, W - pad * 2); tr(hash, pad, H - 48); }
    tr(headEl, pad, pad);
    layers.forEach((l) => l.place(geo));
  };

  const sched = scheduler();
  sched.add(ID, () => {
    const r = track.getBoundingClientRect();
    last = teardownState(stageProgress(r.top, r.height, innerHeight));
    if (last.index !== shown) { shown = last.index; headEl.textContent = `${String(shown).padStart(2, '0')} ${STATES[shown].name} · ${STATES[shown].meaning}`; }
    if (hash) { const s = last.hash.settle; hash.style.opacity = String(s); hash.style.clipPath = `inset(0 ${(1 - s) * 100}% 0 0)`; }
    layers.forEach((l) => l.apply(last));
    return false; // drawn once; sleep until the next scroll or resize
  });

  root.querySelector('h2')!.after(track);
  root.classList.add('is-live');
  measure();
  const wake = () => sched.invalidate(ID);
  const offs = [trackScroll(wake), trackViewport(() => { measure(); wake(); })];
  wake();
  return () => { offs.forEach((f) => f()); sched.remove(ID); track.remove(); root.classList.remove('is-live'); };
}
