/**
 * Synthesized sound kit (no audio files — everything here is generated with Web Audio). Lazy-loaded:
 * sound-toggle.ts only imports this once sound is actually on, so the ~zero-cost default is silence
 * and zero bytes. One AudioContext, created lazily on the first real user gesture after sound is
 * enabled, never on load (browsers would keep it suspended regardless). Master gain has a hard
 * ceiling so this always reads as texture, never as music. Every export here is safe to call even if
 * audio is unsupported, suspended, or not yet unlocked — each one just no-ops.
 */
import type { CueName } from './cue';

const CEILING = 0.16; // hard ceiling: texture, not music
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let unsupported = false;

function ensureContext(): AudioContext | null {
  if (ctx || unsupported) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) { unsupported = true; return null; }
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = CEILING;
    master.connect(ctx.destination);
  } catch { unsupported = true; ctx = null; }
  return ctx;
}

/** Call from a real click/keydown handler: the only context in which resume() is allowed to work. */
export function unlock(): void { ensureContext()?.resume().catch(() => {}); }

/** Toggling sound off suspends rather than closes: playCue checks `state === 'running'`, so this is
 *  enough to go silent immediately without tearing down and re-creating the context on every flip. */
export function mute(): void { ctx?.suspend().catch(() => {}); }

/** One-shot: the next pointerdown or keydown anywhere unlocks audio, for visitors whose sound was
 *  already on from a previous visit (so this load itself is never the gesture). */
export function armGestureUnlock(): void {
  const once = { once: true, passive: true } as const;
  addEventListener('pointerdown', unlock, once);
  addEventListener('keydown', unlock, once);
}

export function armCueListener(): void {
  addEventListener('vishva:cue', (e) => playCue((e as CustomEvent<CueName>).detail));
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  const buf = c.createBuffer(1, c.sampleRate, c.sampleRate); // 1 s, sliced per cue
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

function filteredNoise(c: AudioContext, { freq, q, type, durMs, peak }: { freq: number; q: number; type: BiquadFilterType; durMs: number; peak: number }) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const filt = c.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = freq;
  filt.Q.value = q;
  const gain = c.createGain();
  const now = c.currentTime;
  const end = now + durMs / 1000;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + Math.min(0.006, durMs / 4000));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  src.connect(filt).connect(gain).connect(master!);
  src.start(now);
  src.stop(end + 0.02);
}

function sineBlip(c: AudioContext, { freq, durMs, peak }: { freq: number; durMs: number; peak: number }) {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const gain = c.createGain();
  const now = c.currentTime;
  const end = now + durMs / 1000;
  gain.gain.setValueAtTime(peak, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(gain).connect(master!);
  osc.start(now);
  osc.stop(end + 0.02);
}

/** `decodeMs` lets the 'decode' cue's fade match however long that particular decode run takes. */
export function playCue(name: CueName, decodeMs = 420): void {
  const c = ctx; // never force-create here: a cue fired before any gesture must stay silent, not create a dead context
  if (!c || c.state !== 'running' || !master) return;
  switch (name) {
    case 'click': filteredNoise(c, { freq: 2200, q: 0.8, type: 'highpass', durMs: 12, peak: 0.5 }); break;
    case 'decode': filteredNoise(c, { freq: 900, q: 0.6, type: 'lowpass', durMs: decodeMs, peak: 0.12 }); break;
    case 'enter': sineBlip(c, { freq: 96, durMs: 220, peak: 0.4 }); break;
    case 'tick': sineBlip(c, { freq: 2400, durMs: 45, peak: 0.35 }); break;
  }
}
