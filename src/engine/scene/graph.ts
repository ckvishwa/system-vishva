/**
 * Scene graph layout. Pure: takes the parsed systems-graph.yaml and a tier,
 * returns normalised geometry. The static SVG and the WebGL scene both start
 * from the same YAML, so they cannot drift apart (ARD L-03 fallback parity).
 */
import { TIER_CONFIG, type Tier } from '../tier';

export interface GraphData {
  nodes: { id: string; label: string; x: number; y: number }[];
  edges: [string, string][];
}

/** Semantic tone, mapped to a CSS custom property by the renderer. */
export type Tone = 'system' | 'risk' | 'text';

export interface LayoutNode { id: string; x: number; y: number; tone: Tone }
export interface LayoutEdge { from: number; to: number }
export interface Layout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  /** Line segments per edge; edges are subdivided so they can bend with the pointer field. */
  segments: number;
}

/** Authorization = operational/pass, Security = risk/block. Everything else is neutral. */
const TONES: Record<string, Tone> = { authorization: 'system', security: 'risk' };

export function layoutGraph(data: GraphData, tier: Tier): Layout {
  const segments = TIER_CONFIG[tier].edgeSegments;
  if (segments === 0) return { nodes: [], edges: [], segments: 0 }; // tier C: static SVG only

  const index = new Map(data.nodes.map((n, i) => [n.id, i]));
  const nodes = data.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, tone: TONES[n.id] ?? 'text' }));
  const edges = data.edges.map(([a, b]) => {
    const from = index.get(a);
    const to = index.get(b);
    if (from === undefined || to === undefined) throw new Error(`systems-graph: edge [${a}, ${b}] references an unknown node`);
    return { from, to };
  });
  return { nodes, edges, segments };
}

/** Point at t (0..1) along an edge, in the 0–100 layout box. */
export function edgePoint(layout: Layout, edge: LayoutEdge, t: number): { x: number; y: number } {
  const a = layout.nodes[edge.from];
  const b = layout.nodes[edge.to];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
