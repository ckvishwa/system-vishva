/**
 * ARD §5 — the ONE frame loop on the site.
 * Subscribers mark themselves dirty; the loop runs only while something is dirty,
 * then sleeps. Anything else calling requestAnimationFrame directly is a bug.
 */
export type Tick = (dt: number, now: number) => boolean | void; // return true = still dirty next frame

interface Sub { tick: Tick; dirty: boolean }

export function createScheduler(raf = (cb: FrameRequestCallback) => requestAnimationFrame(cb), caf = (id: number) => cancelAnimationFrame(id)) {
  const subs = new Map<string, Sub>();
  let frame = 0;
  let last = 0;
  let paused = false;

  const loop = (now: number) => {
    frame = 0;
    const dt = last ? Math.min(now - last, 100) : 16.7; // clamp after tab switch
    last = now;
    let anyDirty = false;
    for (const sub of subs.values()) {
      if (!sub.dirty) continue;
      sub.dirty = sub.tick(dt, now) === true;
      anyDirty ||= sub.dirty;
    }
    if (anyDirty && !paused) frame = raf(loop);
    else last = 0;
  };

  const wake = () => { if (!frame && !paused) frame = raf(loop); };

  return {
    add(id: string, tick: Tick) { subs.set(id, { tick, dirty: true }); wake(); return () => subs.delete(id); },
    invalidate(id: string) { const s = subs.get(id); if (s) { s.dirty = true; wake(); } },
    remove(id: string) { subs.delete(id); },
    pause() { paused = true; if (frame) { caf(frame); frame = 0; } last = 0; },
    resume() { paused = false; if ([...subs.values()].some((s) => s.dirty)) wake(); },
    get running() { return frame !== 0; },
    get size() { return subs.size; },
    destroy() { this.pause(); subs.clear(); },
  };
}

export type Scheduler = ReturnType<typeof createScheduler>;

let shared: Scheduler | null = null;
/** Site-wide singleton; pauses automatically when the tab is hidden. */
export function scheduler(): Scheduler {
  if (!shared) {
    shared = createScheduler();
    document.addEventListener('visibilitychange', () => (document.hidden ? shared!.pause() : shared!.resume()));
  }
  return shared;
}
