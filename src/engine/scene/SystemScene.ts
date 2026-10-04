/**
 * The single WebGL canvas (ARD D-06). Nodes are one InstancedMesh, edges one LineSegments.
 * Geometry comes from systems-graph.yaml via layoutGraph(), the same data as the static SVG.
 * Renders only when the scheduler asks (frame()), and releases everything in dispose().
 * Three.js is imported here and only here, always dynamically, after first paint (ARD L-03).
 */
import { TIER_CONFIG, type Tier } from '../tier';
import { layoutGraph, type GraphData, type Tone } from './graph';
import { createIdleTimer } from '../idle';
import { lerp } from '../input/gyro';

export interface SceneHandle {
  /** Normalised viewport pointer (-1..1), as produced by input/pointer.ts. */
  setPointer(x: number, y: number): void;
  /** CSS pixel size of the canvas box. */
  resize(w: number, h: number): void;
  /** The canvas moved relative to the viewport (page scroll). */
  boundsChanged(): void;
  /** Render one frame. Returns true while still animating (idle drift, easing). */
  frame(dt: number): boolean;
  dispose(): void;
}

const NODE_PX = 7;              // matches the static SVG marker
const REACT_RADIUS_PX = 160;    // pointer influence, fine pointers only
const NODE_GROW = 0.6;          // max extra scale for a node under the pointer
const BEND_UNITS = 1.4;         // max edge bend away from the pointer, in 0–100 layout units
const DRIFT_UNITS = 0.5;        // idle edge sag amplitude
const EASE_TAU_MS = 140;
const SETTLE_MS = 1000;         // drift fades out over the last second so the scene rests flat

const TONE_VAR: Record<Tone, string> = { system: '--c-system', risk: '--c-risk', text: '--c-text' };

/** Frame-rate independent exponential ease. */
const k = (dt: number) => 1 - Math.exp(-dt / EASE_TAU_MS);

export async function createSystemScene(canvas: HTMLCanvasElement, tier: Tier, data: GraphData): Promise<SceneHandle> {
  const layout = layoutGraph(data, tier);
  if (!layout.nodes.length) throw new Error('SystemScene: tier has no scene');

  const {
    WebGLRenderer, Scene, OrthographicCamera, InstancedMesh, PlaneGeometry, MeshBasicMaterial,
    BufferGeometry, BufferAttribute, LineSegments, LineBasicMaterial, Color, Matrix4, DynamicDrawUsage,
  } = await import('three');

  const css = getComputedStyle(document.documentElement);
  const colour = (v: string) => new Color(css.getPropertyValue(v).trim());

  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIER_CONFIG[tier].dpr));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  // 0–100 layout box, stretched to the canvas exactly like the SVG's preserveAspectRatio="none".
  // Three is y-up, the YAML is y-down, so every y is written as 100 - y.
  const camera = new OrthographicCamera(0, 100, 100, 0, -1, 1);

  // Edges
  const segs = layout.segments;
  const verts = layout.edges.length * segs * 2;
  const edgePos = new Float32Array(verts * 3);
  const edgeGeo = new BufferGeometry();
  const edgeAttr = new BufferAttribute(edgePos, 3);
  edgeAttr.setUsage(DynamicDrawUsage);
  edgeGeo.setAttribute('position', edgeAttr);
  const edgeMat = new LineBasicMaterial({ color: colour('--c-rule') });
  scene.add(new LineSegments(edgeGeo, edgeMat));

  // Nodes
  const nodeGeo = new PlaneGeometry(1, 1);
  const nodeMat = new MeshBasicMaterial();
  const nodes = new InstancedMesh(nodeGeo, nodeMat, layout.nodes.length);
  nodes.instanceMatrix.setUsage(DynamicDrawUsage);
  layout.nodes.forEach((n, i) => nodes.setColorAt(i, colour(TONE_VAR[n.tone])));
  scene.add(nodes);

  const idle = createIdleTimer();
  const m = new Matrix4();
  const grow = new Float32Array(layout.nodes.length); // eased per-node extra scale

  let w = canvas.clientWidth || 1;
  let h = canvas.clientHeight || 1;
  let time = 0;
  let boundsDirty = true;
  let rect = { left: 0, top: 0 };
  let target: { x: number; y: number } | null = null; // client px
  let cur = { x: 0, y: 0 };                            // eased client px
  let pointerActive = false;

  const wakeUp = () => idle.wake();

  /** Draws one frame; returns true while nodes are still easing toward the pointer. */
  function draw(): boolean {
    if (boundsDirty) { const r = canvas.getBoundingClientRect(); rect = { left: r.left, top: r.top }; boundsDirty = false; }
    const px = pointerActive ? cur.x - rect.left : -1e6; // pointer in canvas px
    const py = pointerActive ? cur.y - rect.top : -1e6;
    const amp = Math.min(1, idle.remaining / SETTLE_MS);

    // nodes
    let settling = false;
    layout.nodes.forEach((n, i) => {
      const dx = (n.x / 100) * w - px, dy = (n.y / 100) * h - py;
      const f = Math.max(0, 1 - Math.hypot(dx, dy) / REACT_RADIUS_PX);
      const goal = NODE_GROW * f * f;
      grow[i] = lerp(grow[i], goal, 0.25);
      if (Math.abs(goal - grow[i]) > 0.002) settling = true;
      const s = 1 + grow[i];
      m.makeScale(((NODE_PX * s) / w) * 100, ((NODE_PX * s) / h) * 100, 1).setPosition(n.x, 100 - n.y, 0);
      nodes.setMatrixAt(i, m);
    });
    nodes.instanceMatrix.needsUpdate = true;

    // edges: subdivided polylines; interior points sag with idle drift and bend away from the pointer
    let o = 0;
    layout.edges.forEach((e, ei) => {
      const a = layout.nodes[e.from], b = layout.nodes[e.to];
      const ex = b.x - a.x, ey = b.y - a.y, len = Math.hypot(ex, ey) || 1;
      const nx = -ey / len, ny = ex / len; // unit normal in layout space
      const pt = (i: number) => {
        const t = i / segs, env = Math.sin(Math.PI * t);
        let x = a.x + ex * t, y = a.y + ey * t;
        const sag = Math.sin(time * 0.0009 + ei * 1.7 + i * 0.9) * DRIFT_UNITS * env * amp;
        x += nx * sag; y += ny * sag;
        const dx = (x / 100) * w - px, dy = (y / 100) * h - py;
        const d = Math.hypot(dx, dy), f = Math.max(0, 1 - d / REACT_RADIUS_PX);
        if (f > 0 && d > 0) { const push = f * f * BEND_UNITS * env; x += (dx / d) * push; y += (dy / d) * push; }
        return [x, 100 - y] as const;
      };
      let prev = pt(0);
      for (let i = 1; i <= segs; i++) {
        const p = pt(i);
        edgePos[o++] = prev[0]; edgePos[o++] = prev[1]; edgePos[o++] = 0;
        edgePos[o++] = p[0]; edgePos[o++] = p[1]; edgePos[o++] = 0;
        prev = p;
      }
    });
    edgeAttr.needsUpdate = true;
    renderer.render(scene, camera);
    return settling;
  }

  return {
    setPointer(nx, ny) {
      target = { x: ((nx + 1) / 2) * innerWidth, y: ((ny + 1) / 2) * innerHeight };
      if (!pointerActive) { cur = { ...target }; pointerActive = true; }
      wakeUp();
    },
    resize(nw, nh) {
      w = Math.max(1, nw); h = Math.max(1, nh);
      renderer.setSize(w, h, false);
      boundsDirty = true;
      wakeUp();
    },
    boundsChanged() { boundsDirty = true; if (pointerActive) wakeUp(); },
    frame(dt) {
      time += dt;
      const drifting = idle.tick(dt);
      let easing = false;
      if (target) {
        const t = k(dt);
        cur = { x: lerp(cur.x, target.x, t), y: lerp(cur.y, target.y, t) };
        easing = Math.hypot(target.x - cur.x, target.y - cur.y) > 0.5;
      }
      const settling = draw();
      return drifting || easing || settling;
    },
    dispose() {
      nodeGeo.dispose(); nodeMat.dispose(); nodes.dispose();
      edgeGeo.dispose(); edgeMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // frees the GPU context now, not at GC time
    },
  };
}
