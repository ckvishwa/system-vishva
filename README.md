# SYSTEM://VISHVA

Portfolio of Vishva Teja Chikoti. AI systems engineering with security and reliability as first-class constraints.

The site is built to read as "this person thinks in systems": it ships through its own release gate, every number on it comes
from an evidence ledger, and its status page reports its own build, tests, JS budget and security headers. Nothing on it is
typed in to look technical.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Astro 7, static output, TypeScript (ADR-0001, ADR-0011) |
| Hero | Plain Three.js in one TS module, one canvas, render on demand (ADR-0002, ADR-0006) |
| Diagrams | SVG, never WebGL (ADR-0005) |
| Motion | CSS and the Web Animations API first; one frame loop, `src/engine/scheduler.ts` (ADR-0003) |
| Scroll story | `input/scroll.ts` + the scheduler, no animation library (ADR-0014) |
| Page transitions | Astro `ClientRouter` view transitions with a per-project signature (ADR-0007) |
| Content | Astro content collections plus `claims.yaml`, the evidence ledger (ADR-0010) |
| Hosting | Vercel, static (ADR-0011), strict CSP |

Layers never import upward: `src/content` (facts) → `src/pages` (routes) → `src/components` (static HTML) → `src/engine`
(runtime JS). Only `src/islands/` hydrates. Rules for contributors, human or AI, are in [CLAUDE.md](./CLAUDE.md).

## Commands

```bash
npm install
npm run dev           # http://localhost:4321 (generates build data first)
npm run preview       # serve the built site
npm run preview:lan   # same, on your local network, for testing on a phone
npm test              # unit tests (vitest)
npm run test:e2e      # Playwright. If it can't download its browser: PW_CHANNEL=chrome npm run test:e2e
npm run build         # verify-claims, build-manifest, astro build
npm run size          # JS budgets (size-limit)
npm run gate          # the release gate, below
npm run check:headers # security headers vs the built HTML
npm run csp:update    # recompute the CSP hash after the inline tier script changes
```

## How the gate works

`npm run gate` is the only command a deployment builds with (`vercel.json` sets it as the build command, and CI runs it too):

1. **claims**: every metric in `src/content/claims/claims.yaml` needs an evidence link. Strict, except on Vercel *preview*
   deployments so work in progress can still be tested on a phone; the site then shows BLOCK on `/status`.
2. **tests**: unit tests, with a JSON report.
3. **build**: `astro build`.
4. **size**: pre-LCP JS under 60 KB gzipped, homepage total under 250 KB, terminal chunk under 6 KB.
5. **build again**: on purpose. The first build cannot know the JS sizes (they exist only after a build), so the second one bakes
   the measured figures into `/status` and the homepage strip. What ships is always this second build.
6. **headers**: `vercel.json` has every security header and the CSP's script hash matches the inline script in the built HTML.

CI (`.github/workflows/release-gate.yml`) then runs Lighthouse budgets and the Playwright suite, which includes 0-idle-frame
checks on every page, the terminal, `/status`, and a run of the whole site under the real CSP with zero violations.

## Security headers

`vercel.json` sets a strict Content-Security-Policy (everything `'self'`; no `'unsafe-inline'` or `'unsafe-eval'` anywhere), HSTS,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a Permissions-Policy that allows the
accelerometer and gyroscope for this origin only, and immutable caching for `/_astro/*`. The site ships no inline styles and no
inline handlers; its single inline script (the pre-paint render-tier decision) is allowed by hash. Change that script and
`npm run check:headers` fails until you run `npm run csp:update`.

## Architecture decisions

| ADR | Decision |
| --- | --- |
| [0001](docs/adr/0001-astro-over-next.md) | Astro over Next.js |
| [0002](docs/adr/0002-plain-three-no-r3f.md) | Plain Three.js, no React Three Fiber |
| [0003](docs/adr/0003-css-waapi-first.md) | CSS and the Web Animations API first |
| [0004](docs/adr/0004-gsap-case-studies-only.md) | GSAP only on case studies (superseded by 0014) |
| [0005](docs/adr/0005-svg-for-diagrams.md) | SVG for readable diagrams |
| [0006](docs/adr/0006-one-webgl-canvas.md) | Exactly one WebGL canvas |
| [0007](docs/adr/0007-view-transitions.md) | Astro view transitions |
| [0008](docs/adr/0008-react-islands-only.md) | React only for stateful islands |
| [0009](docs/adr/0009-no-lenis.md) | No smooth-scroll library |
| [0010](docs/adr/0010-claims-ledger.md) | Every metric comes from the claims ledger |
| [0011](docs/adr/0011-static-vercel.md) | Static deploy to Vercel |
| [0012](docs/adr/0012-atmosphere-layer.md) | Atmosphere layer |
| [0013](docs/adr/0013-brutalist-telemetry.md) | Brutalist telemetry layer |
| [0014](docs/adr/0014-scroll-story-without-gsap.md) | Scroll story without GSAP |
| [0015](docs/adr/0015-evidence-kinds.md) | Evidence kinds: public, self-hosted, on request |

The full architecture record is [docs/ARD.md](docs/ARD.md); scroll storyboards are in `docs/storyboards/`.

## Status

- [x] Phase 0: scaffold, tokens, content schemas, claims ledger, gate
- [x] Phase 1: WebGL hero, waveform transition, Rexi scroll story, atmosphere layer
- [x] Phase 1.5: layers, cells, `/status`, telemetry strip, command terminal
- [x] Phase 1.6: scroll story without GSAP, strict CSP and security headers, Vercel config
- [ ] Phase 2: proof layer (MalTrace transition, evidence drawer, QualityMesh gate demo, OG images)
- [ ] Evidence for every claim: public link, self-hosted file or declared on-request (the gate blocks on unverified)
- [ ] Re-capture full Rexi suite and switch rexi-tests to self-hosted
- [ ] Fill `measuredOn` for the MalTrace claims; fix the MalTrace README prose that says 95% (its output says 94.2%)
- [ ] Rexi beat 5 needs real captured interpreter outputs: `src/content/work/rexi/README.md`
- [ ] Real domain in `astro.config.mjs`, email and LinkedIn in `contact.astro`
- [ ] Hand tests on a real Android phone and iPhone
- [ ] On first Vercel deploy, open /logs and confirm real commits show
