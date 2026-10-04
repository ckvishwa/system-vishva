/**
 * ARD §4 — decides render tier once, at boot.
 *   A: strong desktop → full WebGL, pointer, cursor
 *   B: normal phone/laptop → WebGL at lower DPR, fewer nodes, gyro
 *   C: weak device, reduced motion, save-data, no WebGL → static
 * Pure function so it is unit-testable; Base.astro inlines an equivalent copy before paint.
 */
export type Tier = 'A' | 'B' | 'C';

export interface Signals {
  reducedMotion: boolean;
  saveData: boolean;
  webgl2: boolean;
  cores: number;          // navigator.hardwareConcurrency
  memoryGB: number | null; // navigator.deviceMemory (Chromium only)
  coarsePointer: boolean; // touch-first device
}

export function decideTier(s: Signals): Tier {
  if (s.reducedMotion || s.saveData || !s.webgl2) return 'C';
  if (s.cores <= 4 || (s.memoryGB !== null && s.memoryGB <= 2)) return 'C';
  if (s.coarsePointer) return 'B';
  if (s.cores >= 8 && (s.memoryGB === null || s.memoryGB >= 8)) return 'A';
  return 'B';
}

export function readSignals(): Signals {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  let webgl2 = false;
  try { webgl2 = !!document.createElement('canvas').getContext('webgl2'); } catch { webgl2 = false; }
  return {
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: !!nav.connection?.saveData,
    webgl2,
    cores: nav.hardwareConcurrency ?? 4,
    memoryGB: nav.deviceMemory ?? null,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
  };
}

/** Reads the tier the inline boot script already wrote. */
export function currentTier(): Tier {
  const t = document.documentElement.dataset.tier;
  return t === 'A' || t === 'B' ? t : 'C';
}

/** Node count always comes from systems-graph.yaml; tiers vary DPR and edge subdivision only. */
export const TIER_CONFIG = {
  A: { dpr: 1.5, edgeSegments: 12, render: true, gyro: false, cursor: true },
  B: { dpr: 1.25, edgeSegments: 6, render: true, gyro: true, cursor: false },
  C: { dpr: 1, edgeSegments: 0, render: false, gyro: false, cursor: false },
} as const;
