# SYSTEM://VISHVA — Portfolio Architecture Requirements Document

Oct 4, 2026 · @Vishva

## 1. Purpose and locked decisions

The portfolio is a static-first Astro site where every page ships as HTML and only four islands run JavaScript. Its single job: make a reviewer think "this person thinks in systems" within 20 seconds.

**Identity statement (every decision is tested against it):** AI systems engineering with security and reliability as first-class constraints.

The two source plans disagree on the stack (plan 1 says Next.js + Framer Motion + R3F; plan 2 says Astro + GSAP + plain Three.js). This ARD resolves it in favour of plan 2.

| ID | Decision | Rejected alternative | Why |
| --- | --- | --- | --- |
| D-01 | Astro + TypeScript, static output | Next.js App Router | Content site; React runtime over every page wastes the 150 KB budget |
| D-02 | Plain Three.js in a TS module, no R3F | React Three Fiber | One canvas does not justify React + R3F weight |
| D-03 | CSS + Web Animations API for \~70% of motion | Framer Motion everywhere | Browser-native, zero bundle cost |
| D-04 | GSAP + ScrollTrigger, lazy-loaded, case-study pages only | GSAP site-wide | Only scroll storytelling needs it |
| D-05 | SVG for every diagram a visitor must read | WebGL diagrams | Readable, selectable, accessible, animatable via stroke-dashoffset |
| D-06 | Exactly one WebGL canvas, homepage only | Per-section canvases | Mobile GPU and battery |
| D-07 | Astro View Transitions (ClientRouter) for page moves | Custom SPA router | Native API with built-in fallback |
| D-08 | React islands only where state is real (Systems graph, QualityMesh demo) | React for everything | Islands architecture |
| D-09 | No Lenis smooth scroll in V1 | Lenis | Conflicts with plan 1's own "no scroll hijacking" rule (see §6) |
| D-10 | Every metric on the site comes from one claims ledger with an evidence link | Hard-coded numbers in copy | "Measure before claiming" applied to the portfolio itself |
| D-11 | Deploy to Vercel as static output | SSR | Nothing on the site needs a server in V1 |

Write each decision as a short ADR file in `docs/adr/` so the repo itself shows the reasoning.

## 2. System flow

Data moves strictly downward: content is validated at build, the release gate decides if the build ships, pages arrive as plain HTML, and only then does the boot script decide which islands wake up.

&#91;embedded content: system flow · content to engine, 5 layers\]

The gate's `verdict.json` is also read back by the footer status bar, so the site reports its own build health.

## 3. Folder structure

The repo splits into four layers that never import upward: `content` (facts) → `pages` (routes) → `components` (static HTML) → `engine` (runtime JS). Create these folders first, then fill them phase by phase.

```text
system-vishva/
├── astro.config.mjs            # static output, view transitions, sitemap
├── package.json
├── tsconfig.json               # strict, path aliases @engine @content @ui
├── .size-limit.json            # JS budget per route
├── lighthouserc.json           # LCP / CLS / TBT gates
├── .github/workflows/
│   └── release-gate.yml        # build → claims → budgets → e2e → deploy
│
├── docs/
│   ├── ARD.md                  # export of this document
│   ├── adr/                    # 0001-astro-over-next.md … one per decision
│   └── storyboards/            # rexi.md, maltrace.md … scroll beat sheets
│
├── public/
│   ├── fonts/                  # self-hosted, subsetted woff2
│   ├── og/                     # 1200×630 per page, generated at build
│   └── favicon.svg
│
├── scripts/
│   ├── verify-claims.ts        # fails build if a metric has no evidence
│   ├── gen-og.ts               # OG images from page frontmatter
│   └── build-manifest.ts       # writes build hash + commit for status bar
│
├── src/
│   ├── content.config.ts       # Zod schemas for all collections
│   ├── content/
│   │   ├── work/               # rexi.mdx maltrace.mdx qualitymesh.mdx cloudshield.mdx
│   │   ├── lab/                # reva.md access-risk-analyzer.md fulfillx.md …
│   │   ├── claims/             # claims.yaml — the evidence ledger
│   │   ├── principles.yaml     # "Model proposes. Software authorizes." …
│   │   └── systems-graph.yaml  # nodes, edges, node → project links
│   │
│   ├── pages/
│   │   ├── index.astro
│   │   ├── work/index.astro
│   │   ├── work/[slug].astro
│   │   ├── lab/index.astro
│   │   ├── systems.astro
│   │   ├── about.astro
│   │   ├── contact.astro
│   │   ├── plain.astro         # recruiter mode (see §7)
│   │   ├── logs.astro          # changelog of the site itself
│   │   └── 404.astro
│   │
│   ├── layouts/
│   │   ├── Base.astro          # head, fonts, tier boot script, nav, status bar
│   │   └── CaseStudy.astro     # hero, storyboard slots, evidence drawer
│   │
│   ├── components/
│   │   ├── ui/                 # Panel Mono Metric StatusBar Nav SystemRecord
│   │   ├── diagrams/           # ArchDiagram.astro Node.astro Edge.astro
│   │   ├── case/               # per-project static sections
│   │   └── evidence/           # EvidenceDrawer.astro ClaimRef.astro
│   │
│   ├── islands/                # the ONLY hydrated code
│   │   ├── HeroScene.astro     # mounts engine/scene, client:idle
│   │   ├── ScrollStory.astro   # mounts engine/scroll, client:visible
│   │   ├── SystemsGraph.tsx    # React, client:visible
│   │   └── ReleaseGateDemo.tsx # React, client:visible
│   │
│   ├── engine/                 # framework-free runtime
│   │   ├── tier.ts             # capability detection → A / B / C
│   │   ├── scheduler.ts        # the one frame loop (see §5)
│   │   ├── input/
│   │   │   ├── pointer.ts
│   │   │   ├── gyro.ts         # iOS permission flow inside
│   │   │   └── visibility.ts   # IntersectionObserver + page visibility
│   │   ├── scene/
│   │   │   ├── SystemScene.ts  # Three.js setup, DPR clamp, dispose()
│   │   │   ├── graph.ts        # node/edge layout from systems-graph.yaml
│   │   │   └── shaders/        # node.vert node.frag edge.frag
│   │   ├── motion/
│   │   │   ├── tokens.ts       # durations, easings — mirrors tokens.css
│   │   │   ├── reveal.ts       # WAAPI mask reveals, line tracing
│   │   │   ├── count.ts        # metric count-up
│   │   │   └── scroll.ts       # GSAP lazy import + ScrollTrigger setup
│   │   ├── transitions/        # per-project signature exits (see §7)
│   │   └── cursor.ts           # context cursor, pointer:fine only
│   │
│   └── styles/
│       ├── tokens.css          # colour, space, radius, z-index
│       ├── type.css            # two families, fluid scale
│       ├── motion.css          # keyframes + reduced-motion overrides
│       └── global.css
│
└── tests/
    ├── e2e/                    # Playwright: nav, transitions, reduced motion
    ├── visual/                 # screenshot diffs per tier
    └── engine/                 # Vitest: tier.ts, scheduler.ts, gyro math
```

## 4. Key files and what to build in each

Twelve files carry the architecture; get these right and the rest is content. Ordered by when you touch them.

| File | Owns | Work on first | Done when |
| --- | --- | --- | --- |
| `styles/tokens.css` | Colours, radius 0/2/4px, spacing, z-index | The 8 colour tokens from plan 1 §18, semantic names only (`--c-system`, `--c-risk`, `--c-info`) | No hex value appears anywhere else in the repo |
| `styles/type.css` | Grotesk + mono pairing, fluid scale | Pick one pair (suggest Inter Tight + JetBrains Mono), subset to Latin | Hero name renders with no layout shift (CLS 0) |
| `motion/tokens.ts` | 4 durations, 3 easings | Mirror CSS custom properties so CSS and JS share one clock | Every animation imports from here |
| `content.config.ts` | Zod schemas for work, lab, claims | `work` schema: slug, title, thesis, status, stack, claimIds\[\], signature | Build fails on a missing field |
| `content/claims/claims.yaml` | Every number on the site | List each metric (323+ tests, 50/50 pricing parity, 71 golden evals, 94,958 API calls, 54 features, 95%) with source URL | `verify-claims.ts` passes |
| `engine/tier.ts` | Decides A / B / C once at boot | Read reduced-motion, WebGL2 support, `hardwareConcurrency`, `deviceMemory`, save-data; set `data-tier` on `<html>` | Unit tests cover all 3 outcomes |
| `engine/scheduler.ts` | The single `requestAnimationFrame` loop | Subscribe / unsubscribe API, auto-sleep when no subscriber is dirty | Idle page shows 0 frames in DevTools Performance |
| `engine/scene/SystemScene.ts` | Three.js renderer, camera, graph mesh | DPR clamp (A: 1.5, B: 1.25), instanced nodes, `dispose()` on navigation | 50+ FPS on a mid-range Android |
| `engine/input/gyro.ts` | Orientation → normalised x/y, lerped | iOS `requestPermission()` from a tap, clamp to 3–8 px | Works on iPhone Safari after one tap; silent elsewhere |
| `layouts/Base.astro` | Head, inline tier script, nav, status bar | Inline tier script before first paint so CSS can branch on `data-tier` | No flash of the wrong tier |
| `components/diagrams/ArchDiagram.astro` | SVG architecture from a node list | Takes `nodes[]` + `edges[]` props; outputs paths with `pathLength="1"` for easy tracing | Rexi pipeline renders static with zero JS |
| `pages/work/[slug].astro` | Case-study route | `getStaticPaths` from the work collection, `CaseStudy` layout | All four projects build from MDX alone |

## 5. Runtime loop inventory

The site has exactly one frame loop (`scheduler.ts`); every other row below is an event source feeding it. Anything else that calls `requestAnimationFrame` directly is a bug. When no subscriber is dirty, the loop stops.

| Loop / listener | Runs on | Starts when | Stops when | Tier C |
| --- | --- | --- | --- | --- |
| Scheduler rAF | Every page with an island | A subscriber marks itself dirty | No dirty subscriber for 1 frame | Never starts |
| Hero render | Home | Hero visible AND (pointer moved OR gyro changed OR idle drift active) | Hero off-screen, tab hidden, or drift budget spent | Static SVG grid instead |
| Idle drift | Home | Page load | After 6 s with no input, then sleeps until input | Off |
| Pointer listener | Home, Systems | `pointer: fine` and island mounted | Island unmounted | Passive, no render |
| Gyro listener | Home, mobile | User grants permission (iOS) or API present (Android) | Hero off-screen or tab hidden | Off |
| ScrollTrigger | Case studies | Story section enters viewport (`client:visible`) | Page navigation → `ScrollTrigger.killAll()` | Sections render final state |
| Cursor follower | All pages, desktop | `pointer: fine` and tier A | Pointer leaves window | Native cursor |
| Count-up | Metric blocks | Block enters viewport | Count finishes (≤ 800 ms) | Final number shown |

**Cleanup rule:** every island exports `mount()` and `destroy()`. Astro fires `astro:before-swap` on navigation; `destroy()` must cancel listeners, kill ScrollTriggers, and call `renderer.dispose()` plus geometry/material disposal. A leaked WebGL context after 10 navigations is a release blocker.

## 6. Loopholes in the two plans

Twelve gaps would break the site or contradict its own principles if built as written. Each has a fix already folded into this ARD.

| # | Loophole | Risk | Resolution |
| --- | --- | --- | --- |
| L-01 | Plan 1 picks Next + Framer + R3F; plan 2 picks Astro + GSAP + Three | Two half-built stacks | D-01, D-02: Astro wins |
| L-02 | "Subtle animated connections" vs "no continuous render when idle" | Either dead hero or battery drain | Idle drift for 6 s, then sleep until input (§5) |
| L-03 | Three.js core is roughly 150 KB gzipped on its own vs a 150 KB initial-JS budget | Budget blown on page one | Three loads `client:idle` after LCP; budget applies to pre-LCP JS; static SVG grid paints first |
| L-04 | iOS Safari blocks device orientation until `DeviceOrientationEvent.requestPermission()` is called from a tap | Gyro silently never works on iPhone | Small "ENABLE DEPTH" chip on iOS only; Android just works |
| L-05 | "Fake command lines" banned, yet "command execution" animation proposed | Site violates its own rule | Every terminal sequence replays a real captured log stored in `content/` with its source |
| L-06 | Metrics (323+ tests, 95%, 94,958 calls) hard-coded in copy | Stale or unverifiable claims in interviews | Claims ledger + `verify-claims.ts` gate (D-10) |
| L-07 | "Every project gets its own motion identity" vs "one consistent motion system" | Visual chaos | Shared primitives (trace, mask, count, node) + one signature exit per project (§7) |
| L-08 | Lenis suggested while "custom scroll hijacking" is banned | Self-contradiction, jank on mobile | No Lenis in V1 (D-09) |
| L-09 | Custom system cursor has no touch or keyboard story | Lost affordance on phones, a11y fail | Cursor only on `pointer: fine` + tier A; all labels also exist as visible text and focus styles |
| L-10 | Scroll-pinned GSAP sections hide content from screen readers and keyboard users | Inaccessible case studies | Every storyboard step is real HTML in reading order; GSAP only animates it |
| L-11 | Lab statuses ("ACTIVE") go stale silently | Abandoned work looks dishonest | `lastTouched` date required in schema; status auto-shows "DORMANT" after 90 days |
| L-12 | A 30-second recruiter skim was never designed for | Great site, lost interview | `/plain` recruiter mode + one-page PDF link in nav (§7) |

Open question: CloudShield and FulfillX have no source facts yet; their pages stay out of Phase 1 until claims exist for them.

## 7. Creative work

The strongest creative move is making the portfolio obey the same rules as the projects it shows: the site is itself a gated, measured, fail-closed system. Ten ideas, each tied to the identity.

1. **The site ships through its own QualityMesh.** The CI release gate (claims verified, budgets met, e2e green) writes a JSON verdict at build time. The footer status bar reads it: `BUILD 7f3a1c · GATE: PASS · LCP 1.9s · JS 84KB`. The QualityMesh case study links to this live gate as its demo.
2. **Evidence drawer.** Any metric with a dotted underline opens a side drawer showing its source: test output, commit, eval file. "Measure before claiming" becomes something a visitor can click.
3. **Model proposes, software authorizes — as an interaction.** On the Rexi page, a visitor types an order sentence; a canned interpreter output shows the proposed intent in muted text, then the deterministic layer stamps it VALIDATED or REJECTED in system green or risk red. All outputs are pre-recorded from real runs (no live LLM, no fake).
4. **Signature exits.** One per project, built from shared primitives: Rexi's record collapses into a waveform that becomes the pipeline; MalTrace's row resolves into a SHA-256 that hashes character by character into the case study; CloudShield streams audit lines across the wipe; QualityMesh stamps PASS on the outgoing page.
5. **Graph that knows the visitor's path.** Hero nodes for pages already visited stay lit on return (sessionStorage only). The map fills in as they explore.
6. **`/plain` recruiter mode.** Same content, zero motion, single column, print-ready, linked as `[PLAIN]` in the nav. Shows confidence: the work survives without the effects.
7. **`/logs` as a changelog.** The site's own git history rendered as a telemetry feed. Proves the portfolio is maintained, not abandoned.
8. **404 as a fail-closed event.** `REQUEST DENIED · ROUTE NOT IN ALLOWLIST · RETURNING TO KNOWN STATE` with a link home. On-theme, one line, no gimmick.
9. **Tier is visible.** Status bar shows `RENDER: TIER B` on phones. Turns a performance decision into a talking point.
10. **Keyboard command bar.** `/` opens a minimal command palette (`open rexi`, `goto lab`, `mode plain`). Real navigation, not a fake terminal.

Cut list if time runs short: 5, 9, 10. Never cut 1, 2, 6.

## 8. Budgets and release gate

A build that misses any hard budget does not deploy. The gate runs in `.github/workflows/release-gate.yml` and its verdict feeds the footer status bar (§7, idea 1).

| Gate | Threshold | Tool | Hard / soft |
| --- | --- | --- | --- |
| Pre-LCP JavaScript | < 60 KB gzipped (Three.js excluded, loads after) | size-limit | Hard |
| Total JS, home | < 250 KB gzipped incl. Three.js | size-limit | Hard |
| Total JS, case study | < 90 KB gzipped incl. GSAP | size-limit | Hard |
| LCP, mobile throttled | < 2.5 s | Lighthouse CI | Hard |
| CLS | < 0.02 | Lighthouse CI | Hard |
| Hero FPS, mid Android | ≥ 50 tier B, ≥ 30 tier C-fallback | Manual + Playwright trace | Soft |
| Idle frames, home | 0 after 6 s no input | Playwright performance trace | Hard |
| WebGL contexts | 1, and 0 leaked after 10 navigations | Playwright e2e | Hard |
| Claims | Every metric has a resolvable source | `verify-claims.ts` | Hard |
| Reduced motion | No transform animation runs | Playwright with `reducedMotion: 'reduce'` | Hard |
| Accessibility | 0 serious axe violations | axe-core in Playwright | Hard |
| Fonts | ≤ 2 families, ≤ 4 files, subsetted woff2 | build script | Soft |

Test devices: one mid-range Android on Chrome, one iPhone on Safari, desktop Chrome and Firefox.

## 9. Build order

Start with Phase 0 today, then build the hero plus one Rexi transition before any other page; nothing advances past a gate that fails.

&#91;embedded content: build order · 4 phases, 3 gates\]

**Today's checklist**

- [ ] `npm create astro@latest system-vishva` (empty template, strict TS)
- [ ] Create every folder in §3, with an empty `index` or `.gitkeep`
- [ ] Write ADRs 0001–0011 from the decisions table in §1
- [ ] Fill `tokens.css` and `type.css`; self-host the two font families
- [ ] Write `tier.ts` and `scheduler.ts` with Vitest tests
- [ ] Start `claims.yaml` with every number from the Rexi and MalTrace plans, each with a source
- [ ] Write the Rexi storyboard in `docs/storyboards/rexi.md` (beats, scroll %, what animates, what it communicates)
