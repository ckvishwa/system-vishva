import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { layoutGraph, edgePoint, type GraphData } from '../../src/engine/scene/graph';
import { TIER_CONFIG } from '../../src/engine/tier';

const real = parse(readFileSync('src/content/systems-graph.yaml', 'utf8')) as GraphData;

describe('scene graph layout (systems-graph.yaml)', () => {
  it('keeps every node at its YAML position, so WebGL matches the SVG', () => {
    const l = layoutGraph(real, 'A');
    expect(l.nodes).toHaveLength(real.nodes.length);
    real.nodes.forEach((n, i) => expect(l.nodes[i]).toMatchObject({ id: n.id, x: n.x, y: n.y }));
  });

  it('resolves every edge to node indices', () => {
    const l = layoutGraph(real, 'B');
    expect(l.edges).toHaveLength(real.edges.length);
    l.edges.forEach((e, i) => {
      expect(l.nodes[e.from].id).toBe(real.edges[i][0]);
      expect(l.nodes[e.to].id).toBe(real.edges[i][1]);
    });
  });

  it('rejects an edge that points at an unknown node', () => {
    expect(() => layoutGraph({ nodes: real.nodes, edges: [['voice', 'nope']] }, 'A')).toThrow(/unknown node/);
  });

  it('assigns semantic tones: authorization=system, security=risk, rest neutral', () => {
    const tone = Object.fromEntries(layoutGraph(real, 'A').nodes.map((n) => [n.id, n.tone]));
    expect(tone.authorization).toBe('system');
    expect(tone.security).toBe('risk');
    expect(tone.voice).toBe('text');
  });

  it('density follows the tier config; tier C is empty (static SVG only)', () => {
    expect(layoutGraph(real, 'A').segments).toBe(TIER_CONFIG.A.edgeSegments);
    expect(layoutGraph(real, 'B').segments).toBe(TIER_CONFIG.B.edgeSegments);
    expect(TIER_CONFIG.A.edgeSegments).toBeGreaterThan(TIER_CONFIG.B.edgeSegments);
    expect(layoutGraph(real, 'C')).toEqual({ nodes: [], edges: [], segments: 0 });
  });

  it('DPR clamps match the spec', () => {
    expect(TIER_CONFIG.A.dpr).toBe(1.5);
    expect(TIER_CONFIG.B.dpr).toBe(1.25);
  });

  it('edgePoint interpolates between endpoints', () => {
    const l = layoutGraph({ nodes: [{ id: 'a', label: 'a', x: 0, y: 0 }, { id: 'b', label: 'b', x: 10, y: 20 }], edges: [['a', 'b']] }, 'A');
    expect(edgePoint(l, l.edges[0], 0.5)).toEqual({ x: 5, y: 10 });
  });
});
