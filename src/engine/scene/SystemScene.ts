/**
 * PHASE 1 — the single WebGL canvas (ARD D-06). Stub with the contract the hero island expects.
 * Rules: DPR clamp per tier, instanced nodes, render only when invalidated, dispose() on navigation.
 */
import type { Tier } from '../tier';

export interface SceneHandle {
  setPointer(x: number, y: number): void;
  setTilt(x: number, y: number): void;
  resize(w: number, h: number): void;
  /** Render one frame. Returns true while still animating (idle drift, easing). */
  frame(dt: number): boolean;
  dispose(): void;
}

export async function createSystemScene(_canvas: HTMLCanvasElement, _tier: Tier): Promise<SceneHandle> {
  // const THREE = await import('three');  ← Phase 1: lazy import keeps three out of pre-LCP JS (L-03)
  throw new Error('SystemScene: implement in Phase 1 (see ARD §9)');
}
