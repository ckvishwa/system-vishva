# SYSTEM://VISHVA

Portfolio of Vishva Teja Chikoti. AI systems engineering with security and reliability as first-class constraints.

```bash
npm install
npm run dev        # http://localhost:4321
npm test           # engine unit tests
npm run build      # verify-claims → build-manifest → astro build
npm run gate       # what CI runs: strict claims + build + budgets + tests
```

## Layers (never import upward)

`src/content` (facts) → `src/pages` (routes) → `src/components` (static HTML) → `src/engine` (runtime JS)

Only `src/islands/` hydrates. The site has one frame loop: `src/engine/scheduler.ts`.

## Phase 0 status

- [x] Folders, tokens, type, motion primitives
- [x] Content schemas + claims ledger + verify gate
- [x] tier.ts + scheduler.ts + gyro math, unit-tested
- [x] Static pages: home, work, case study, lab, about, contact, plain, logs, 404
- [ ] Fill evidence links in claims.yaml (status bar shows GATE: BLOCK until then — on purpose)
- [ ] Real domain in astro.config.mjs, email/LinkedIn in contact.astro
## Phase 1 status

- [x] WebGL hero (SystemScene, one canvas, render on demand, tier A/B only), cross-fade from the static SVG
- [x] Waveform page transition, reusable signature registry (MalTrace 'hash' plugs in later)
- [x] Rexi scroll story (ScrollStory island, GSAP lazy-loaded on case studies only)
- [x] Atmosphere layer, ADR-0012 (parallax, redaction, decrypt, glitch in transitions, HUD, grain)
- [ ] Rexi beat 5 needs captured interpreter outputs: src/content/work/rexi/README.md
- [ ] Phase 1 hand tests on a real Android phone and iPhone (see the Phase 1 report)

## Phase 1.5 status

- [x] Cascade layers, `data-fx` effects, spec-sheet cells, 4px section rules, tabular-nums, container queries
- [x] Homepage telemetry strip and `/status` (gate, claims ledger, this visitor, history, lab)
- [x] Hard shadows (interactive only), one inverted block per page, grid coordinates
- [x] Command terminal (`/` or the nav item): lazy, 6 KB budget, real data only
- [ ] Phone checks: the terminal on iOS and Android (keyboard, 100dvh), hard-shadow tap states

`npm run test:e2e` needs a browser. If Playwright cannot download its own, run `PW_CHANNEL=chrome npm run test:e2e`.
