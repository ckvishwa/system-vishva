/**
 * Surveillance HUD (meaning: state). Real data only: the session clock, the pointer, the route.
 * It is driven by the hero's scheduler subscription, writes the DOM only when a value changes, and
 * therefore sleeps with the hero. It never prints a command or output that did not happen.
 */
const pad = (n: number, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

/** Session timecode HH:MM:SS:FF (30 fps frame count within the second). */
export function timecode(ms: number, fps = 30): string {
  const s = Math.floor(ms / 1000);
  return `${pad(s / 3600)}:${pad((s / 60) % 60)}:${pad(s % 60)}:${pad(((ms % 1000) / 1000) * fps)}`;
}

/** The real route as a shell-style prompt: "/" -> "vishva@system:~$", "/work/rexi/" -> "vishva@system:~/work/rexi$". */
export function prompt(path: string): string {
  const p = path.replace(/\/+$/, '');
  return `vishva@system:~${p}$`;
}

export const coords = (x: number, y: number) => `X ${pad(x, 4)}  Y ${pad(y, 4)}`;

export function createHud(root: HTMLElement, path = location.pathname) {
  const time = root.querySelector<HTMLElement>('[data-hud-time]');
  const xy = root.querySelector<HTMLElement>('[data-hud-xy]');
  const cmd = root.querySelector<HTMLElement>('[data-hud-prompt]');
  const shown = new Map<HTMLElement, string>();
  const write = (el: HTMLElement | null, text: string) => {
    if (el && shown.get(el) !== text) { shown.set(el, text); el.textContent = text; } // only when it changed
  };
  let pointer: { x: number; y: number } | null = null;
  write(cmd, prompt(path));

  return {
    setPointer(x: number, y: number) { pointer = { x, y }; },
    /** `now` is the scheduler's frame time, i.e. milliseconds since the page's time origin. */
    tick(now: number) {
      write(time, timecode(now));
      if (pointer) write(xy, coords(pointer.x, pointer.y));
    },
  };
}
