# ADR-0016 Teardown pattern

Status: accepted · Date: 2026-10-06 · Builds on ADR-0014 and ADR-0015

## Decision
A case study may show its subject being dismantled, layer by layer, in a sticky scroll stage. The pattern has four parts so
Rexi and QualityMesh can reuse it.

1. **Real inputs, validated.** The layers come from artifacts checked into `src/content/work/<slug>/`, each with a zod schema
   (`src/content/teardown.ts`). `scripts/verify-teardown.ts` runs in `prebuild` and fails the build on a malformed file or any
   disagreement with the claims ledger or the case study's frontmatter. Only identity fields are required; a missing field hides
   its layer. Nothing is invented or defaulted.
2. **A pure timeline.** `teardownState(progress)` (`src/engine/motion/teardown-state.ts`) returns every layer's opacity and
   parameters for a progress 0..1. Seven states each own a seventh of the scroll, each with one meaning from the motion
   vocabulary. Layers cross-fade across boundaries, so the function is continuous and reversible. It has no DOM and no clock, so
   it is unit-tested at every boundary and for continuity.
3. **A static document first.** `components/case/Teardown.astro` renders all states as a vertical document with every number
   visible. That is the complete experience for no JS, reduced motion, tier C, `/plain` and assistive tech. On tier A/B a lazy
   script reads that markup (`data-td-*`), builds an `aria-hidden` sticky stage, and visually hides the document.
4. **No new loop.** The stage subscribes to `input/scroll.ts` and the shared scheduler, draws once per scroll or resize and
   sleeps, so an idle page renders 0 frames. It animates transform, opacity and clip-path only, in DOM and SVG, never WebGL.
   The lazy chunk has its own size-limit entry (5 KB gz for MalTrace).

To reuse it, write the artifacts and a schema, a layer list and state table, then a stage builder that maps layers onto the same
`Layers` shape; keep the static document as the source the stage reads.

## Where it lives
`src/engine/motion/` (next to the scroll story), not `src/engine/fx/`. The 4 KB gzip budget on `fx/` belongs to the atmosphere
layer (ADR-0012) and a case-study scroll story is not one. Putting it there would have meant either breaking that budget or
raising it.

## Rejected
- **WebGL or a canvas.** The teardown is a diagram a visitor must read, so it is DOM (ADR-0005).
- **An animation library or a loop of its own** (ADR-0014).
- **Timed animation.** Everything is a function of scroll position, so it can be scrubbed, reversed and tested without a clock.
- **Hiding the document with `display: none` or `aria-hidden`.** The static document stays available to assistive tech and
  keyboard users; only the visual stage is `aria-hidden`.
- **Reading numbers from copy.** Counts come from the claims ledger or the artifacts. The 46/8 split is two ledger claims whose
  sum the build checks against the 54 total.

## Why
The point of the page is that its numbers are evidence. A scroll story that can be generated only from checked artifacts, fails
the build when they disagree, and falls back to a plain document is the same discipline the site applies to its claims.
