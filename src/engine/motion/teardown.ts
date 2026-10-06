/**
 * MalTrace teardown stage (ADR-0016). Lazy-loaded by components/case/Teardown.astro on tier A/B only.
 * One object, the sample, is transformed from sealed file to finished investigation while the camera follows the scroll.
 * It reads the static document that component rendered (data-td-* attributes) and builds an aria-hidden sticky stage from it.
 * Scroll (input/scroll.ts) sets a target progress; a critically damped spring (spring.ts) glides the displayed progress to it
 * on the shared scheduler, and teardown-state.ts maps that onto persistent elements: transform, opacity and clip-path only.
 * Geometry is measured on load and on resize (ResizeObserver, debounced) and cached, so a frame never reads layout. The spring
 * sleeps once it settles: a page that has stopped scrolling renders 0 frames. No animation library, no loop of its own.
 * A missing piece of data means that layer is not built. Nothing is invented: every label and number is read from the document.
 */
import { scheduler } from '../scheduler';
import { trackScroll } from '../input/scroll';
import { springStep, settled, type Spring } from './spring';
import { teardownState, stageProgress, slabHeights, barLengths, STATES, type Layers } from './teardown-state';

type R = { x: number; y: number; w: number; h: number };
type Geo = { W: number; H: number; mobile: boolean; pad: number; slabs: R; side: R; proc: R; main: R };
type Layer = { place(g: Geo): void; apply(l: Layers): void };

const ID = 'teardown';
const num = new Intl.NumberFormat('en-US');
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const R0: R = { x: 0, y: 0, w: 0, h: 0 };
/** translate3d, then optional scale (sy defaults to sx). */
const tr = (e: HTMLElement, x: number, y: number, sx = 1, sy = sx) => { e.style.transform = `translate3d(${x}px,${y}px,0)${sx === 1 && sy === 1 ? '' : ` scale(${sx},${sy})`}`; };
const box = (e: HTMLElement, w: number, h?: number) => { e.style.width = `${w}px`; if (h !== undefined) e.style.height = `${h}px`; };
const op = (e: HTMLElement, v: number) => { e.style.opacity = String(v); };
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
  const procs = +(root.dataset.procs ?? 0);
  const statics = all('[data-td-static]').map((e) => e.dataset.name!);
  const dyn = +(root.dataset.dynamic ?? 0), stat = +(root.dataset.static ?? 0);
  const verdict = one('[data-td-verdict]')?.textContent ?? '';
  const sub = one('[data-td-sub]')?.textContent ?? '';
  const shap = all('[data-td-shap]').map((e) => ({ name: e.dataset.name!, v: +e.dataset.impact! }));
  const tags = all<HTMLAnchorElement>('[data-td-attack]').map((a) => ({ id: a.textContent!, href: a.href }));
  const stages = (root.dataset.pipeline ?? '').split('|').filter(Boolean);

  // ---- build the stage: a world the camera moves, and a HUD that stays put
  const track = el('div', 'td-track');
  const stage = el('div', 'td-stage', undefined, track);
  stage.setAttribute('aria-hidden', 'true');
  const world = el('div', 'td-world', undefined, stage);
  const headEl = el('p', 'td-head mono', '', stage);
  const an = root.dataset.analysis ? el('p', 'td-an mono muted', `Analysis ${root.dataset.analysis}`, stage) : null;
  const title = file ? el('p', 'td-title mono', `${file.dataset.name} · ${num.format(+file.dataset.size!)} bytes`, stage) : null;
  const sha = file?.dataset.sha ?? '';
  const hash = file ? el('p', 'td-sha mono muted', sha, stage) : null;
  const layer = (parent: Element = world) => el('div', 'td-layer', undefined, parent);
  const layers: Layer[] = [];
  let cx = 0, cy = 0; // where the slabs, the process nodes and the matrix are pulled to
  let mid: [number, number] = [0, 0]; // the model node's centre
  let bars = { x: 0, ax: 0, half: 0, y0: 0, rh: 0, off: 4 };
  const shapLen = barLengths(shap.map((s) => s.v));

  if (secs.length) {
    const g = layer();
    const slabs = secs.map((s) => {
      const e = el('div', 'td-slab', undefined, g);
      el('i', 'td-fill', undefined, e).style.opacity = String(Math.min(1, s.ent / 8) * 0.3); // fill density follows entropy
      return { e, lab: el('p', 'td-lab mono', `${s.name} · ${num.format(s.size)} bytes\nentropy ${s.ent.toFixed(2)}${s.note ? ` · ${s.note}` : ''}`, g), h: 0, y: 0 };
    });
    let gx = 0, gp = 0, gw = 0, m = false;
    layers.push({
      place(geo) {
        const r = geo.slabs, hs = slabHeights(secs.map((s) => s.size), r.h * (geo.mobile ? 0.5 : 0.6), 8);
        m = geo.mobile;
        gw = m ? r.w * 0.58 : Math.min(r.w, 300);
        gx = r.x;
        gp = (r.h - hs.reduce((a, b) => a + b, 0)) / Math.max(1, slabs.length - 1);
        let y = r.y;
        slabs.forEach((s, i) => { s.h = hs[i]; s.y = y; y += hs[i]; box(s.e, gw, hs[i]); box(s.lab, m ? gw : r.w - gw - 12); });
      },
      apply(l) {
        const f = l.pull, x = lerp(lerp(cx - gw / 2, gx, l.slabs.x), cx - gw / 2, f);
        op(g, l.slabs.opacity);
        slabs.forEach((s, i) => {
          const y = s.y + l.slabs.gap * gp * i, flat = lerp(1, 0.03, f);
          tr(s.e, x, lerp(y + (s.h * (1 - flat)) / 2, cy, f), 1, flat); // slabs resize with scaleY, never height
          tr(s.lab, m ? x : x + gw + 12, m ? y + s.h + 2 : y + Math.max(0, (s.h - 14) / 2));
          op(s.lab, l.slabs.labels);
        });
      },
    });
  }

  if (apis.length) {
    const g = layer();
    const counts = barLengths(apis.map((a) => a.count));
    const totalEl = total !== null ? el('p', 'td-total mono', '', g) : null;
    const rows = apis.map((a) => ({ name: el('p', 'td-api mono', `${a.name} ${num.format(a.count)}`, g), bar: el('i', 'td-bar', undefined, g) }));
    let rh = 0, shownTotal = -1, r = R0;
    layers.push({
      place(geo) {
        r = geo.side;
        rh = Math.min(30, (r.h - 36) / rows.length);
        if (totalEl) { box(totalEl, r.w); tr(totalEl, r.x, r.y); }
        rows.forEach((o, i) => { box(o.name, r.w); box(o.bar, r.w, 3); tr(o.name, r.x, r.y + 36 + i * rh); });
      },
      apply(l) {
        op(g, l.stream.opacity);
        if (totalEl) { const n = Math.round(total! * l.stream.bars); if (n !== shownTotal) { shownTotal = n; totalEl.textContent = `${num.format(n)} API calls`; } } // only when the integer changes
        rows.forEach((o, i) => {
          const s = clamp(l.stream.bars * 1.5 - i / (rows.length * 2)) * counts[i] * (1 - l.pull);
          o.bar.style.transform = `translate3d(${r.x}px,${r.y + 36 + i * rh + Math.min(16, rh - 4)}px,0) scaleX(${s})`;
        });
      },
    });
  }

  if (procs) {
    // process_count nodes. The teardown data has no parent/child links, so there are no edges and no invented tree.
    const g = layer();
    const ns = Array.from({ length: procs }, () => el('i', 'td-proc', undefined, g));
    const cap = el('p', 'td-lab mono', `${procs} processes`, g);
    let pos: [number, number][] = [];
    layers.push({
      place(geo) {
        const r = geo.proc, cols = Math.max(1, Math.floor(r.w / 22));
        pos = ns.map((_, i) => [r.x + (i % cols) * 22, r.y + 28 + Math.floor(i / cols) * 22]);
        box(cap, r.w); tr(cap, r.x, r.y);
        ns.forEach((n) => box(n, 14, 14));
      },
      apply(l) {
        op(g, l.procs.opacity);
        ns.forEach((n, i) => tr(n, lerp(pos[i][0], cx, l.pull), lerp(pos[i][1], cy, l.pull), clamp(l.procs.grow * procs - i)));
      },
    });
  }

  const cells = Array.from({ length: dyn + stat }, (_, i) => ({ e: null as HTMLElement | null, i }));
  if (cells.length) {
    const g = layer();
    cells.forEach((c) => { c.e = el('i', `td-cell${c.i >= dyn ? ' is-static' : ''}`, undefined, g); if (c.i >= dyn) c.e.title = statics[c.i - dyn] ?? ''; });
    const lab1 = el('p', 'td-lab mono', `${dyn} dynamic behavioral`, g);
    const lab2 = el('p', 'td-lab mono info', `${stat} static PE`, g);
    const mdl = el('p', 'td-model mono', root.dataset.model ?? 'model', world);
    let pos: [number, number][] = [], from: [number, number][] = [], size = 0;
    layers.push({
      place(geo) {
        const r = geo.main, cols = geo.mobile ? 8 : 12;
        size = Math.min(26, (r.w - 8) / cols - 4);
        const step = size + 4, x0 = r.x + (r.w - cols * step) / 2, rows = Math.ceil(dyn / cols);
        pos = cells.map((c) => c.i < dyn ? [x0 + (c.i % cols) * step, r.y + 24 + Math.floor(c.i / cols) * step] : [x0 + ((c.i - dyn) % cols) * step, r.y + 48 + (rows + Math.floor((c.i - dyn) / cols)) * step]);
        from = cells.map((c) => [geo.side.x + ((c.i * 37) % geo.side.w), geo.side.y + ((c.i * 53) % geo.side.h)]);
        mid = [r.x + r.w / 2, r.y + r.h * 0.3];
        cells.forEach((c) => box(c.e!, size, size));
        box(lab1, r.w); box(lab2, r.w);
        tr(lab1, r.x, r.y); tr(lab2, r.x, r.y + 24 + rows * step);
        box(mdl, 200, 56); tr(mdl, mid[0] - 100, mid[1] - 28);
      },
      apply(l) {
        const a = l.grid.assemble, k = l.grid.converge;
        op(g, l.grid.opacity);
        op(mdl, l.model.opacity);
        cells.forEach((c) => {
          const [px, py] = pos[c.i], [fx, fy] = from[c.i];
          tr(c.e!, lerp(lerp(fx, px, a), mid[0] - size / 2, k), lerp(lerp(fy, py, a), mid[1] - size / 2, k), lerp(1, 0.3, k));
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
        d = [r.x + (r.w - w * 0.7) / 2, 120]; // docks top-centre, clear of the file title, even after the camera pulls back
        [blk, bar].forEach((e) => box(e, w, 56));
        box(note, w);
      },
      apply(l) {
        const v = l.verdict, s = lerp(1, 0.7, v.dock), x = lerp(c[0], d[0], v.dock), y = lerp(c[1], d[1], v.dock);
        op(g, v.opacity);
        tr(blk, x, y, s); tr(bar, x, y, s); tr(note, x, y + 56 * s + 4);
        bar.style.clipPath = `inset(0 0 0 ${v.reveal * 100}%)`; // the redaction wipes away as it is stamped
      },
    });
  }

  // SHAP bars open out of the model node; the ATT&CK nodes then grow out of the bar ends. The nodes are a plain ordered grid:
  // several of these techniques belong to more than one tactic, so grouping by tactic would be a guess.
  if (shap.length) {
    const g = layer();
    const rows = shap.map((s) => ({ s, lab: el('p', 'td-lab mono', `${s.name} ${s.v > 0 ? '+' : ''}${s.v}`, g), bar: el('i', `td-push ${s.v > 0 ? 'is-risk' : 'is-ok'}`, undefined, g) }));
    const cap = el('p', 'td-lab mono muted', `← away from malicious · toward malicious →${root.dataset.base ? `\nSHAP base value ${root.dataset.base}` : ''}`, g);
    layers.push({
      place(geo) {
        const r = geo.main, lw = geo.mobile ? r.w : Math.min(230, r.w * 0.42), half = (r.w - (geo.mobile ? 0 : lw)) / 2;
        bars = { x: r.x, ax: r.x + (geo.mobile ? 0 : lw) + half, half, y0: r.y + 108, rh: Math.min(geo.mobile ? 40 : 30, (r.h - 108) / rows.length), off: geo.mobile ? 18 : 4 };
        box(cap, r.w); tr(cap, r.x, r.y + 64);
        rows.forEach((o) => { box(o.lab, lw); box(o.bar, half, 8); });
      },
      apply(l) {
        const { x, ax, half, y0, rh, off } = bars, e = l.explain;
        op(g, e.opacity);
        op(cap, e.open);
        rows.forEach((o, i) => {
          const left = o.s.v < 0, y = lerp(mid[1], y0 + i * rh, e.open); // rows fan out of the model node
          tr(o.lab, x, y);
          op(o.lab, e.open);
          o.bar.style.transformOrigin = left ? 'right center' : 'left center';
          o.bar.style.transform = `translate3d(${left ? ax - half : ax}px,${y + off}px,0) scaleX(${shapLen[i] * e.bars})`;
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
        pts = els.map((_, i) => [r.x + (i % cols) * cw, r.y + 108 + Math.floor(i / cols) * 40]);
        els.forEach((a) => box(a, cw - 8));
      },
      apply(l) {
        els.forEach((a, i) => {
          const o = clamp(l.map.grow * (els.length + 3) - i), j = i % Math.max(1, shap.length);
          const fx = bars.ax + (shap[j]?.v < 0 ? -1 : 1) * bars.half * (shapLen[j] ?? 0), fy = bars.y0 + j * bars.rh; // the end of a bar
          op(a, o);
          tr(a, lerp(fx, pts[i][0], o), lerp(fy, pts[i][1], o));
        });
      },
    });
  }

  // PULL-BACK: the camera has zoomed out; the chain of stages, each with its real number, is what is left to read
  if (stages.length === 7 && file) {
    const g = layer(stage);
    const vals = [`${sha.slice(0, 8)}…`, `${procs} processes`, total !== null ? num.format(total) : '', `${dyn + stat} features`, verdict.split(' ')[0], shap[0]?.name ?? '', `${tags.length} techniques`];
    const cs = stages.map((s, i) => { const c = el('div', 'td-chain', undefined, g); el('p', 'muted', s, c); el('p', 'td-chain-v', vals[i], c); return c; });
    layers.push({
      place(geo) {
        const cols = geo.mobile ? 2 : 7, cw = (geo.W - geo.pad * 2) / cols, ch = geo.mobile ? 52 : 64;
        cs.forEach((c, i) => { box(c, cw, ch); tr(c, geo.pad + (i % cols) * cw, geo.H - 64 - ch * Math.ceil(7 / cols) + Math.floor(i / cols) * ch); });
      },
      apply(l) { op(g, l.chain.opacity); },
    });
  }

  // ---- geometry: measured on load and on resize, then cached. A frame never reads layout.
  let shown = -1, trackTop = 0, trackH = 0, vh = 0, H = 0;
  const measure = () => {
    const W = stage.clientWidth, mobile = W < 720, pad = mobile ? 16 : 24, full = { x: pad, w: W - pad * 2 };
    H = stage.clientHeight;
    const geo: Geo = {
      W, H, mobile, pad,
      slabs: mobile ? { ...full, y: 120, h: H * 0.42 } : { x: pad, y: 120, w: W * 0.42 - pad, h: H - 200 },
      side: mobile ? { ...full, y: 120 + H * 0.42 + 60, h: H - 120 - H * 0.42 - 116 } : { x: W * 0.44, y: 120, w: W * 0.34 - pad, h: H - 200 },
      proc: mobile ? { x: pad + full.w * 0.62, y: 120, w: full.w * 0.38, h: H * 0.42 } : { x: W * 0.8, y: 120, w: W * 0.2 - pad, h: H - 200 },
      main: { ...full, y: mobile ? 172 : 120, h: H - (mobile ? 252 : 200) }, // mobile leaves room for the docked verdict's two lines
    };
    cx = W / 2; cy = H * 0.42;
    world.style.transformOrigin = `50% ${cy}px`;
    if (title) { box(title, W - pad * 2); tr(title, pad, pad + 40); }
    if (an) tr(an, W - pad - 120, pad);
    if (hash) { box(hash, W - pad * 2); tr(hash, pad, H - 48); }
    tr(headEl, pad, pad);
    layers.forEach((l) => l.place(geo));
    const r = track.getBoundingClientRect();
    trackTop = r.top + scrollY;
    trackH = r.height;
    vh = innerHeight;
  };

  // ---- progress: scroll sets the target, a critically damped spring glides what is shown to it
  let target = 0, drawn = -1, lastN = -1;
  let cur: Spring = { x: 0, v: 0 };
  const HEX = '0123456789abcdef';
  const draw = (p: number) => {
    if (p === drawn) return;
    drawn = p;
    stage.dataset.p = String(Math.round(p * 10000) / 10000); // progress as drawn: tests wait for the glide to land on it
    const l = teardownState(p);
    if (l.index !== shown) { shown = l.index; headEl.textContent = `${String(shown).padStart(2, '0')} ${STATES[shown].name} · ${STATES[shown].meaning}`; }
    world.style.transform = `translate3d(0,${l.cam.y * H}px,0) scale(${l.cam.scale})`; // the camera
    if (hash) {
      // the hash settles character by character, left to right; the rest still scrambles until its turn
      const n = Math.floor(l.hash.settle * sha.length);
      if (n !== lastN) { lastN = n; hash.textContent = sha.slice(0, n) + Array.from({ length: sha.length - n }, (_, i) => HEX[Math.imul(i + n * 64, 2654435761) >>> 28]).join(''); }
    }
    layers.forEach((x) => x.apply(l));
  };
  const retarget = (y: number) => { target = stageProgress(trackTop - y, trackH, vh); };

  const sched = scheduler();
  sched.add(ID, (dt) => {
    cur = springStep(cur, target, dt / 1000);
    const done = settled(cur, target);
    if (done) cur = { x: target, v: 0 };
    draw(cur.x);
    return !done; // keep running only while the glide is still moving; then sleep
  });

  root.querySelector('h2')!.after(track);
  root.classList.add('is-live');
  measure();
  retarget(scrollY);
  cur = { x: target, v: 0 };

  // will-change only while the stage is on screen
  const io = new IntersectionObserver(([e]) => stage.classList.toggle('is-hot', e.isIntersecting));
  io.observe(track);

  let timer = 0;
  const ro = new ResizeObserver(() => { clearTimeout(timer); timer = window.setTimeout(() => { measure(); retarget(scrollY); drawn = -1; sched.invalidate(ID); }, 120); });
  ro.observe(stage);
  ro.observe(document.body); // content above the stage changing height moves the track

  const off = trackScroll((y) => { retarget(y); sched.invalidate(ID); });
  return () => { off(); ro.disconnect(); io.disconnect(); clearTimeout(timer); sched.remove(ID); track.remove(); root.classList.remove('is-live'); };
}
