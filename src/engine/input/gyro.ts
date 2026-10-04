/**
 * ARD L-04 — device orientation → small parallax offset (3–8 px), lerped.
 * iOS Safari requires DeviceOrientationEvent.requestPermission() from a user gesture;
 * call `needsPermission()` to decide whether to show the "Enable depth" chip.
 */
type IOSOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

export const MAX_SHIFT_PX = 8;

export function needsPermission(): boolean {
  return typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as IOSOrientation).requestPermission === 'function';
}

export async function requestGyro(): Promise<boolean> {
  const D = DeviceOrientationEvent as IOSOrientation;
  if (!D.requestPermission) return true;
  try { return (await D.requestPermission()) === 'granted'; } catch { return false; }
}

/** gamma: left/right tilt (-90..90), beta: front/back (-180..180). Returns px offsets. */
export function orientationToOffset(gamma: number, beta: number, restBeta = 45): { x: number; y: number } {
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  return { x: clamp(gamma * 0.08 * 2, MAX_SHIFT_PX), y: clamp((beta - restBeta) * 0.04 * 2, MAX_SHIFT_PX) };
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function trackGyro(onChange: (x: number, y: number) => void): () => void {
  const h = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    const o = orientationToOffset(e.gamma, e.beta);
    onChange(o.x, o.y);
  };
  addEventListener('deviceorientation', h, { passive: true });
  return () => removeEventListener('deviceorientation', h);
}
