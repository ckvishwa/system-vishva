# ADR-0012 Atmosphere layer

Status: accepted · Date: 2026-10-04

## Decision
A small set of effects in `src/engine/fx/` gives the site its tone: quiet, watchful, slightly unsettling. Surveillance and
forensics, not cyberpunk. The darkness comes from composition, restraint and rare, deliberate disruption.

Effects: off-centre composition (CSS), depth parallax, redaction reveal, heading decrypt, a signal glitch inside page
transitions, a real-data HUD on the hero, static film grain (hero and case-study headers, tier A only) and hero scanlines, and one console message.

## Rules (every effect must satisfy all of them)
1. Runs through the scheduler. No `requestAnimationFrame` outside `src/engine/scheduler.ts`. CSS transitions are fine.
2. Off under tier C and `prefers-reduced-motion`. Content still shows in its final state. Anything that could hide content
   (redaction bars) is armed only by `<html data-fx="armed">`, which the pre-paint boot script sets for tiers A/B, and is
   disarmed if the effects script does not report ready within 4 s.
3. Animates only `transform`, `opacity` or `clip-path`. (Text-content updates such as the HUD are not animation.)
4. Maps to one meaning: flow, state, dependency, cause, hierarchy or change.
5. The whole of `src/engine/fx/` stays under 4 KB gzipped (enforced by a unit test).
6. Colours come from `tokens.css`. Only `--c-scan` was added for E7; no new hex values.
7. Real data only. The HUD shows the real session time, pointer and route. No fake commands, no fake output.

| Effect | Meaning |
| --- | --- |
| Parallax depth | hierarchy |
| Redaction reveal | state (evidence surfacing) |
| Heading decrypt | change of state |
| Signal glitch (transitions only) | change |
| HUD | state |

## Grain
Grain is never a fixed full-screen layer: a blended fixed overlay costs scroll performance. It is applied only to the hero and
case-study headers (non-fixed), only on tier A. Tier B drops it entirely.

## Banned
Matrix rain and katakana; skulls, masks, hoodies; "ACCESS GRANTED" / "HACKING…" bars; fake typing; green-on-black as the main
look; constant flicker; looping glitches; chromatic aberration at idle; glow, bloom, neon; anything that makes text hard to read.

## Consequences
- The HUD timecode ticks only while the hero is awake (6 s idle drift after load or input). It then sleeps with the hero, so an
  idle page renders zero frames. On wake it jumps to the real elapsed time.
- Redaction on the beat 4 line is a stepped, 400 ms wipe, the closest the storyboard's "hard cut" allows once a reveal is required.
- The redaction bar is a pseudo-element; the text is in the HTML from the start for screen readers and no-JS users.
