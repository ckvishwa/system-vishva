/**
 * Tiny eager bootstrap for the nav sound toggle. This file is small on purpose — it is the only part
 * of the sound kit that ships on every page load. The real synthesis engine (sound.ts) is dynamically
 * imported, so a visitor who never turns sound on never downloads it.
 */
const KEY = 'vishva-sound';
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function render(btn: HTMLButtonElement, on: boolean, disabled: boolean): void {
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? 'Sound: on' : 'Sound: off';
  btn.disabled = disabled;
}

/** `reasonId` points at the hidden paragraph Nav.astro renders, read by AT only while the control is disabled. */
export function initSoundToggle(btn: HTMLButtonElement, reasonId: string): void {
  const disabled = reducedMotion();
  let on = !disabled && localStorage.getItem(KEY) === '1';
  render(btn, on, disabled);
  if (disabled) { btn.setAttribute('aria-describedby', reasonId); return; } // reduced motion forces audio off, with no control to turn it back on

  if (on) import('./sound').then((s) => { s.armCueListener(); s.armGestureUnlock(); });

  btn.addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage may be unavailable; the toggle still works for this load */ }
    render(btn, on, false);
    if (on) import('./sound').then((s) => { s.armCueListener(); s.unlock(); }); // the click itself is the unlocking gesture
    else import('./sound').then((s) => s.mute());
  });
}
