/**
 * Idle-drift timer. The hero drifts for DRIFT_MS after load (or after the last
 * wake), then sleeps. Pure: callers feed it dt, it says whether to keep rendering.
 */
export const DRIFT_MS = 6000;

export function createIdleTimer(duration = DRIFT_MS) {
  let left = duration;
  return {
    /** Advance by dt ms. Returns true while the drift window is still open. */
    tick(dt: number): boolean {
      left = Math.max(0, left - dt);
      return left > 0;
    },
    /** Input (pointer, gyro, resize) re-opens the window. */
    wake(): void { left = duration; },
    get active() { return left > 0; },
    get remaining() { return left; },
  };
}
