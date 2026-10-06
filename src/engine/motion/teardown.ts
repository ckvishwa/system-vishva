/**
 * MalTrace teardown stage (ADR-0016). Lazy-loaded by components/case/Teardown.astro on tier A/B only.
 * The sample is shown as a CAD exploded view (the PE sections lift out of the file shell in CSS 3D), then taken through the
 * investigation while the camera follows the scroll. It reads the static document that component rendered (data-td-*) and
 * builds an aria-hidden sticky stage from it. Scroll (input/scroll.ts) sets a target progress; a critically damped spring
 * (spring.ts) glides the displayed progress to it on the shared scheduler; teardown-state.ts maps that onto persistent
 * elements: transform, opacity and clip-path only. Geometry is measured on load and on resize (debounced ResizeObserver) and
 * cached, so a frame never reads layout. The spring sleeps once settled: an idle page renders 0 frames. No animation library,
 * no WebGL. Annotations are a flat 2D overlay whose anchors are the slabs' 3D points projected by explode.ts.
 * A missing piece of data hides its layer. Nothing is invented: every label and number is read from the document.
 */
import { scheduler } from '../scheduler';
import { trackScroll } from '../input/scroll';
import { trackGyro } from '../input/gyro';
import { springStep, settled, type Spring } from './spring';
import { teardownState, stageProgress, slabHeights, barLengths, STATES, type Layers } from './teardown-state';
import { storyProgress, storyLength } from './story-map';
import { allocate, assign, flightPos, pointPos, type Flight, type Pt } from './stream';
import { SPREAD, slabTransform, slabPoint, bands, labelSpot } from './explode';

type R = { x: number; y: number; w: number; h: number };
type Geo = { W: number; H: number; mobile: boolean; pad: number; stack: R; proc: R; main: R };
type Layer = { place(g: Geo): void; apply(l: Layers): void };

const ID = 'teardown';
const num = new Intl.NumberFormat('en-US');
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** translate3d, then rotations and scale as given. */
const tr = (e: HTMLElement, x: number, y: number, s = 1, sy = s, z = 0, rot = '') => { e.style.transform = `translate3d(${x}px,${y}px,${z}px)${rot}${s === 1 && sy === 1 ? '' : ` scale(${s},${sy})`}`; };
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
  // ---- the payload: everything the stage shows, built by Teardown.astro from the same data as the static document
  const D = JSON.parse(root.dataset.td!) as {
    f: { z: number; h: string }; t: string; a: string; s?: { l: string; e: number; z: number; o?: number }[]; ln: number; ap?: number[]; tot?: number; np?: number;
    d?: number; st?: number; sn: string[]; dl: string; sl: string; m?: string; v: string; vs: string; sh: { l: string; v: number }[]; sc: string; tg?: [string, string][]; ch?: [string, string][];
  };
  const { f: file, s: secs = [], ap: apis = [], tot: total = null, np: procs = 0, v: verdict, sh: shap, tg: tags = [], ch: stages = [] } = D;
  const dyn = D.d ?? 0, stat = D.st ?? 0, sha = file.h;

  // ---- build the stage: a world the camera moves (and whose perspective the slabs share), and a HUD that stays put
  const track = el('div', 'td-track');
  const stage = el('div', 'td-stage', undefined, track);
  stage.setAttribute('aria-hidden', 'true');
  const world = el('div', 'td-world', undefined, stage);
  const headEl = el('p', 'td-head mono', '', stage);
  const title = el('p', 'td-title mono', D.t, stage);
  const hash = el('p', 'td-sha mono muted', sha, stage);
  const layer = (parent: Element = world) => el('div', 'td-layer', undefined, parent);
  const layers: Layer[] = [];
  // shared between layers (filled in `place`, read in `apply`)
  let cx = 0, cy = 0, dx = 0, dy = 0; // cx, cy: where things are pulled to; dx, dy: gyro depth, at most 6 px
  let mid: [number, number] = [0, 0], cellPos: Pt[] = [];
  let bars = { x: 0, ax: 0, half: 0, y0: 0, rh: 0, off: 4 };
  const shapLen = barLengths(shap.map((s) => s.v));
  let XL = 0, XW = 0, XT = 0, XH = 0, XB = 0, XLW = 0, XLH = 0, XZ = 0, XM = false; // the slab stack, shared with the canvas
  let XG: number[] = [], XA: { x: number; y: number }[] = [], XS: { x: number; y: number; right: boolean; lx: number; ly: number }[] = [];
  let shown = -1, trackTop = 0, trackH = 0, vh = 0, stageW = 0, stageH = 0, mob = false;

  if (secs.length) {
    const g = el('div', 'td-slabs', undefined, world); // the one preserve-3d group
    const shell = el('div', 'td-shell', undefined, g);
    const items = secs.map((s) => {
      const e = el('div', 'td-slab', undefined, g);
      el('i', 'td-fill', undefined, e).style.opacity = String(Math.min(1, s.e / 8) * 0.3); // fill density follows entropy
      // the annotation (s.l) was composed from real data only: a line exists only when the data has it
      return { e, lab: el('p', 'td-lab mono', s.l, world), h: 0, top: 0, b: { y: 0, h: 0 } };
    });
    layers.push({
      place(geo) {
        const r = geo.stack, m = geo.mobile, hs = slabHeights(secs.map((s) => s.z), r.h * (m ? 0.36 : 0.6), 8);
        XM = m; XL = r.x; XW = r.w; XH = Math.min(r.h, r.w * 1.2); XT = r.y + (r.h - XH) / 2; XB = r.y + r.h; XZ = (m ? SPREAD.mobile : SPREAD.desktop).z * 1.1;
        const gp = (r.h - hs.reduce((a, b) => a + b, 0)) / Math.max(1, items.length - 1), bd = bands(secs.map((s) => ({ size: s.z, offset: s.o })), file.z, XH).bands;
        let y = r.y;
        items.forEach((it, i) => { it.h = hs[i]; it.top = y + gp * i; it.b = bd[i]; y += hs[i]; box(it.e, r.w, hs[i]); });
        XG = items.slice(1).map((it, i) => (items[i].top + items[i].h + it.top) / 2);
        XLW = m ? Math.min(250, geo.W * 0.62) : 210; XLH = D.ln * 14 + 4;
        items.forEach((it, i) => { box(it.lab, XLW); it.lab.style.textAlign = i % 2 ? 'right' : 'left'; });
        box(shell, r.w, XH); tr(shell, r.x, XT);
      },
      apply(l) {
        const sp = XM ? SPREAD.mobile : SPREAD.desktop, f = l.pull, o = { x: stageW / 2, y: stageH / 2 };
        op(shell, l.shell.edge); shell.style.setProperty('--f', String(l.shell.fill * 0.3 / Math.max(l.shell.edge, 0.01))); // the fill is the shell's ::before, so it divides out the edge opacity it inherits
        items.forEach((it, i) => {
          const tf = slabTransform(i, items.length, l.slabs.explode, sp), flat = lerp(1, 0.03, f), s0 = lerp(it.b.h / it.h, 1, l.slabs.gap);
          const H = it.h * s0 * flat;
          const top = lerp(lerp(XT + it.b.y, it.top, l.slabs.gap) + (it.h * s0 * (1 - flat)) / 2, cy, f); // band -> lifted -> flattened toward the centre
          const dd = (i + 1) / items.length, x0 = lerp(XL, cx - XW / 2, f);
          tr(it.e, x0 + tf.x + dx * dd, top + H / 2 - it.h / 2 + dy * dd, 1, s0 * flat, tf.z, ` rotateX(${tf.rx}deg) rotateY(${tf.ry}deg)`); // slabs resize with scaleY, never height
          op(it.e, l.slabs.opacity);
          XA[i] = slabPoint({ x: (i % 2 ? 1 : -1) * (XW / 2), y: 0 }, { x: x0 + XW / 2, y: top + H / 2 }, tf, o);
          const sp2 = XS[i] = labelSpot(i, XA[i], top + H, stageW, XM ? 16 : 24, XM, XLW, XLH);
          tr(it.lab, sp2.x, sp2.y);
          op(it.lab, l.slabs.labels);
        });
      },
    });
  }

  if (total !== null || procs) {
    // the API total resolves; the process_count nodes sit beside the stack. The data has no parent/child links, so no edges.
    const g = layer();
    const totalEl = total !== null ? el('p', 'td-total mono', '', g) : null;
    const ns = Array.from({ length: procs }, () => el('i', 'td-proc', undefined, g));
    const pcap = procs ? el('p', 'td-lab mono', `${procs} processes`, g) : null;
    let pos: [number, number][] = [], shownTotal = -1;
    layers.push({
      place(geo) {
        const r = geo.proc, cols = Math.max(1, Math.floor(r.w / 22));
        pos = ns.map((_, i) => [r.x + (i % cols) * 22, r.y + 22 + Math.floor(i / cols) * 22]);
        ns.forEach((e) => box(e, 14, 14));
        if (pcap) { box(pcap, r.w); tr(pcap, r.x, r.y); }
        const tw = geo.mobile ? geo.W - geo.pad * 2 - r.w - 8 : geo.W - geo.pad * 2;
        if (totalEl) { box(totalEl, tw); tr(totalEl, geo.pad, geo.mobile ? XB + 76 : geo.H - 92); }
      },
      apply(l) {
        if (totalEl) { op(totalEl, l.stream.opacity); const v = Math.round(total! * l.stream.total); if (v !== shownTotal) { shownTotal = v; totalEl.textContent = `${num.format(v)} API calls`; } } // only when the integer changes
        if (pcap) op(pcap, l.procs.opacity);
        ns.forEach((e, i) => { op(e, l.procs.opacity); tr(e, lerp(pos[i][0], cx, l.pull), lerp(pos[i][1], cy, l.pull), clamp(l.procs.grow * procs - i)); });
      },
    });
  }

  const cells = Array.from({ length: dyn + stat }, (_, i) => ({ e: null as HTMLElement | null, i }));
  if (cells.length) {
    const g = layer();
    cells.forEach((c) => { c.e = el('i', `td-cell${c.i >= dyn ? ' is-static' : ''}`, undefined, g); if (c.i >= dyn) c.e.title = D.sn[c.i - dyn] ?? ''; });
    const lab1 = el('p', 'td-lab mono', `${D.dl}  +  ${D.sl}`, g);
    const mdl = el('p', 'td-model mono', D.m ?? 'model', world);
    let pos: [number, number][] = [], size = 0, from: [number, number] = [0, 0];
    layers.push({
      place(geo) {
        const r = geo.main, cols = geo.mobile ? 8 : 12;
        size = Math.min(26, (r.w - 8) / cols - 4);
        const step = size + 4, x0 = r.x + (r.w - cols * step) / 2, rows = Math.ceil(dyn / cols);
        pos = cells.map((c) => c.i < dyn ? [x0 + (c.i % cols) * step, r.y + 24 + Math.floor(c.i / cols) * step] : [x0 + ((c.i - dyn) % cols) * step, r.y + 48 + (rows + Math.floor((c.i - dyn) / cols)) * step]);
        cellPos = pos.map((p) => [p[0] + size / 2, p[1] + size / 2]);
        mid = [r.x + r.w / 2, r.y + r.h * 0.3];
        from = [cx, cy];
        cells.forEach((c) => box(c.e!, size, size));
        box(lab1, r.w); tr(lab1, r.x, r.y);
        box(mdl, 200, 56); tr(mdl, mid[0] - 100, mid[1] - 28);
      },
      apply(l) {
        const a = l.grid.assemble, k = l.grid.converge;
        op(g, l.grid.opacity);
        op(mdl, l.model.opacity);
        cells.forEach((c) => {
          const [px, py] = pos[c.i];
          tr(c.e!, lerp(lerp(from[0], px, a), mid[0] - size / 2, k), lerp(lerp(from[1], py, a), mid[1] - size / 2, k), lerp(1, 0.3, k));
        });
      },
    });
  }

  // The stream, the leader lines and the alignment rail: the one 2D canvas. Meaning: flow volume (<= 600 points, each API's
  // share proportional to its real count) and the anchors of the annotations.
  const cv = secs.length ? el('canvas', 'td-canvas') as HTMLCanvasElement : null;
  const ctx = cv?.getContext('2d') ?? null;
  if (cv && ctx) {
    stage.prepend(cv);
    const { lane, cell } = apis.length && cells.length ? assign(allocate(apis), cells.length) : { lane: [], cell: [] };
    const css = getComputedStyle(root);
    const [info, rule] = ['--c-info', '--c-muted'].map((v) => css.getPropertyValue(v).trim() || '#888'); // read once, never inside a frame
    let size = 0, dpr = 1;
    layers.push({
      place(geo) {
        dpr = Math.min(2, devicePixelRatio || 1);
        cv.width = geo.W * dpr; cv.height = geo.H * dpr;
        box(cv, geo.W, geo.H);
        size = Math.max(2, Math.round(geo.W / 400));
      },
      apply(l) {
        const s = l.cam.scale;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.setTransform(s * dpr, 0, 0, s * dpr, dpr * (stageW / 2 - (s * stageW) / 2), dpr * (cy - s * cy + l.cam.y * stageH)); // the camera
        ctx.strokeStyle = rule;
        if (l.scan % 1) { // X-RAY: one scan sweeps the file while 0 < scan < 1, tied to the scroll, never looping
          const y = XT + l.scan * XH;
          ctx.globalAlpha = 0.6;
          ctx.beginPath(); ctx.moveTo(XL, y); ctx.lineTo(XL + XW, y); ctx.stroke();
        }
        if (l.rail) { // EXPLODE, in order: the alignment rail draws down the exploded object, then a leader extends from each annotation to its slab
          ctx.globalAlpha = l.slabs.opacity * 0.5;
          const rx = Math.round(XL + XW / 2) + 0.5, ry = XT - 16;
          ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, lerp(ry, XB + 16, l.rail)); ctx.stroke();
          ctx.globalAlpha = l.slabs.opacity;
          ctx.beginPath();
          XA.forEach((a, i) => { const p = XS[i]; ctx.moveTo(p.lx, p.ly); ctx.lineTo(lerp(p.lx, a.x, l.leader), lerp(p.ly, a.y, l.leader)); });
          ctx.stroke();
        }
        if (l.points.opacity && lane.length) {
          ctx.globalAlpha = l.points.opacity;
          ctx.fillStyle = info;
          const fl: Flight = { x0: XL, x1: XL + XW, gaps: XG.length ? XG : [cy], o: { x: stageW / 2, y: stageH / 2 }, zr: XZ, lanes: apis.length };
          const flow = drawn * 15; // the stream's motion is the scroll position: it runs through a held frame while the visitor scrolls, and stops when they stop
          for (let j = 0; j < lane.length; j++) {
            const f = flightPos(j, lane[j], fl, flow), [x, y] = pointPos([f.x, f.y], cellPos[cell[j]], mid, l.grid.assemble, l.grid.converge), q = size * lerp(f.s, 1, l.grid.assemble);
            ctx.fillRect(x - q / 2, y - q / 2, q, q);
          }
        }
      },
    });
  }

  if (verdict) {
    const g = layer();
    const blk = el('p', 'td-verdict', verdict, g);
    const bar = el('i', 'td-redact', undefined, g);
    const note = el('p', 'td-lab mono muted', D.vs, g);
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

  // SHAP bars open out of the model node; the ATT&CK nodes then grow out of the bar ends into a plain ordered grid (several of
  // these techniques belong to more than one tactic, so grouping by tactic would be a guess).
  if (shap.length) {
    const g = layer();
    const rows = shap.map((s) => ({ s, lab: el('p', 'td-lab mono', s.l, g), bar: el('i', `td-push ${s.v > 0 ? 'is-risk' : 'is-ok'}`, undefined, g) }));
    const cap = el('p', 'td-lab mono muted', D.sc, g);
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
    const els = tags.map(([id, href]) => { const a = el('a', 'td-tag mono', id, g) as HTMLAnchorElement; a.href = href; a.tabIndex = -1; a.target = '_blank'; a.rel = 'noopener'; return a; });
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
          tr(a, lerp(fx, pts[i][0], o) + dx, lerp(fy, pts[i][1], o) + dy);
        });
      },
    });
  }

  // The end of MAP: the camera pulls back and the chain of stages, each with its real number, is what is left to read
  if (stages.length) {
    const g = layer(stage);
    const cs = stages.map(([s, v]) => { const c = el('div', 'td-chain', undefined, g); el('p', 'muted', s, c); el('p', 'td-chain-v', v, c); return c; });
    layers.push({
      place(geo) {
        const cols = geo.mobile ? 2 : 7, cw = (geo.W - geo.pad * 2) / cols, ch = geo.mobile ? 52 : 64;
        cs.forEach((c, i) => { box(c, cw, ch); tr(c, geo.pad + (i % cols) * cw, geo.H - 64 - ch * Math.ceil(cs.length / cols) + Math.floor(i / cols) * ch); });
      },
      apply(l) { op(g, l.chain.opacity); },
    });
  }

  // ---- geometry: measured on load and on resize, then cached. A frame never reads layout.
  const measure = () => {
    const cs = getComputedStyle(stage), sa = Math.max(parseFloat(cs.paddingLeft), parseFloat(cs.paddingRight)) || 0, sb = parseFloat(cs.paddingBottom) || 0; // safe-area insets
    const W = stage.clientWidth, H = stage.clientHeight - sb, mobile = W < 720, pad = (mobile ? 16 : 24) + sa, full = { x: pad, w: W - pad * 2 };
    stageW = W; stageH = H; mob = mobile;
    track.style.height = `${(storyLength(mobile) + 1) * 100}vh`; // the story's length, in viewports: the pacing is set in story-map.ts
    const sw = mobile ? W * 0.76 : Math.min(300, W * 0.26);
    const geo: Geo = {
      W, H, mobile, pad,
      stack: { x: (W - sw) / 2, y: mobile ? 104 : 110, w: sw, h: mobile ? H * 0.52 : H - 250 },
      proc: mobile ? { x: W - pad - 132, y: 104 + H * 0.52 + 76, w: 132, h: 70 } : { x: pad, y: H - 190, w: W * 0.2, h: 90 },
      main: { ...full, y: mobile ? 172 : 120, h: H - (mobile ? 252 : 200) }, // mobile leaves room for the docked verdict's two lines
    };
    cx = W / 2; cy = H * 0.42;
    world.style.transformOrigin = `50% ${cy}px`;
    box(title, W - pad * 2); tr(title, pad, pad + 40);
    box(hash, W - pad * 2); tr(hash, pad, H - 48);
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
  const draw = (p: number) => {
    if (p === drawn) return;
    drawn = p;
    stage.dataset.r = p.toFixed(4); // scroll progress as drawn: tests wait for the glide to land on it
    const l = teardownState(storyProgress(p, mob));
    if (l.index !== shown) { shown = l.index; headEl.textContent = `${D.a} · ${String(shown).padStart(2, '0')} ${STATES[shown].name} · ${STATES[shown].meaning}`; }
    world.style.transform = `translate3d(0,${l.cam.y * stageH}px,0) scale(${l.cam.scale})`; // the camera
    // the hash settles character by character, left to right; the rest still scrambles until its turn
    const k = Math.floor(l.hash.settle * sha.length);
    if (k !== lastN) { lastN = k; hash.textContent = sha.slice(0, k) + sha.slice(k + 11) + sha.slice(k, k + 11); }
    layers.forEach((x) => x.apply(l));
  };
  const retarget = (y: number) => { target = stageProgress(trackTop - y, trackH, vh); };

  // gyro adds depth only (at most 6 px) and never touches progress: scroll owns the story. Events set a goal, a frame eases to it.
  let goal: [number, number] = [0, 0];
  const sched = scheduler();
  sched.add(ID, (dt) => {
    cur = springStep(cur, target, dt / 1000);
    const done = settled(cur, target);
    if (done) cur = { x: target, v: 0 };
    const gMoving = Math.abs(goal[0] - dx) + Math.abs(goal[1] - dy) > 0.05;
    dx = gMoving ? lerp(dx, goal[0], 0.2) : goal[0]; dy = gMoving ? lerp(dy, goal[1], 0.2) : goal[1];
    if (gMoving) drawn = -1;
    draw(cur.x);
    return !done || gMoving; // keep running only while something is still moving; then sleep
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
  const offGyro = trackGyro((x, y) => { goal = [x * 0.75, y * 0.75]; sched.invalidate(ID); }); // 8 px max -> 6 px
  return () => { off(); offGyro(); ro.disconnect(); io.disconnect(); clearTimeout(timer); sched.remove(ID); track.remove(); root.classList.remove('is-live'); };
}
