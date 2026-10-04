# SYSTEM://VISHVA — rules for every session

## Identity
AI systems engineering with security and reliability as first-class constraints.
Site must make a reviewer think "this person thinks in systems", not "this person knows animation libraries". Test every decision against this.

## Hard architecture rules (do not break)
- Astro 7, static output. Layers never import upward: src/content → src/pages → src/components → src/engine. Only src/islands hydrates.
- ONE frame loop: src/engine/scheduler.ts. Never call requestAnimationFrame anywhere else.
- ONE WebGL canvas (#system-environment), homepage only. Plain Three.js in a TS module; no React Three Fiber.
- Three.js dynamically imported AFTER first paint (requestIdleCallback or idle timeout). Never in pre-LCP JS.
- GSAP lazy-imported only by the ScrollStory island, case-study pages only.
- Diagrams a visitor must read are SVG, never WebGL.
- Colours only from src/styles/tokens.css. Accents semantic: --c-system = operational/pass, --c-risk = risk/block, --c-info = information. Border radius 0/2/4px only.
- No new hex values, no gradients, no glow, no decorative particles, no scroll hijacking, no Lenis, no fake terminal output, no invented metrics.
- Every metric comes from src/content/claims/claims.yaml. Never hard-code numbers in copy. Don't touch claims.yaml values.
- Input listeners: pointer.ts, gyro.ts and scroll.ts (src/engine/input/) are the only ones. Effects read from them, never add their own.
- Every animation communicates one of: flow, state, dependency, cause, hierarchy, change. Otherwise delete it.
- No invented copy about the owner's experience. Mark gaps with TODO and list them at end of each phase.
- If a rule blocks something, stop and ask. Do not work around it.

## Atmosphere layer (ADR-0012): Mr. Robot, not Hollywood hacker
Quiet, watchful, slightly unsettling. All effects live in src/engine/fx/ and each one must:
- run through the scheduler (CSS transitions allowed), no rAF elsewhere
- be off under tier C and prefers-reduced-motion, content in its final state (arm hiding effects only via `html[data-fx='armed']`)
- animate only transform, opacity or clip-path
- map to one of: flow, state, dependency, cause, hierarchy, change
- keep src/engine/fx/ under 4 KB gzipped (a unit test enforces it)
Real data only in the HUD (session time, pointer, real route). Redaction on: hero claim, case-study thesis, beat 4 line, metric values.
Decrypt on H1 only, once per element, aria-label holds the real text. Glitch only inside page transitions, never idle or hover.
Banned: Matrix rain/katakana, skulls/masks/hoodies, ACCESS GRANTED/HACKING bars, fake typing, green-on-black as the main look,
constant flicker, looping glitches, idle chromatic aberration, glow/bloom/neon, anything that makes text hard to read.
The only colour token added for this is --c-scan; no other new colours.
Grain is never a fixed full-screen layer: it is applied to the hero and case-study headers only, tier A only.

## Accessibility / motion
- prefers-reduced-motion or tier C: no WebGL, no scroll animation (final state shown), transitions are instant swap.
- All content is real HTML in reading order; animation never hides content from AT/keyboard. Visible focus everywhere.

## Working style
- Small commits, one concern each, written for a public reader (/logs renders git history).
- After each work block: run `npm test` and `npm run build`; report changed / verified / unverified.
- Budgets (do not raise): pre-LCP JS < 60 KB gz; homepage total incl. Three.js < 250 KB gz (`npm run size`).

## Commands
`npm test` · `npm run build` · `npm run size` · `npm run test:e2e` · `npm run gate`
