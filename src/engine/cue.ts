/**
 * Sound cue bus. Every trigger site (decrypt, nav, hero nodes) just fires a DOM event — zero import
 * cost if sound.ts is never loaded, since dispatchEvent with no listener is a no-op. sound-toggle.ts
 * only attaches a listener once the visitor has sound on, so most visits never pay for synthesis code.
 */
export type CueName = 'click' | 'decode' | 'enter' | 'tick';
export const cue = (name: CueName): void => { dispatchEvent(new CustomEvent<CueName>('vishva:cue', { detail: name })); };
