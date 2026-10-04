# SYSTEM://VISHVA

Portfolio of Vishva Teja Chikoti. AI systems engineering with security and reliability as first-class constraints.

```bash
npm install
npm run dev        # http://localhost:4321
npm test           # engine unit tests (tier, scheduler, gyro)
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
- [ ] Phase 1: SystemScene.ts (Three.js), ScrollStory island, Rexi storyboard
