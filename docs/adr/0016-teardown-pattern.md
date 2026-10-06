# ADR-0016 Teardown pattern

Status: accepted · Date: 2026-10-06 · Builds on ADR-0014 and ADR-0015

## Decision
A case study may show its subject being dismantled, layer by layer, in a sticky scroll stage. The pattern has four parts so
Rexi and QualityMesh can reuse it.

1. **Real inputs, validated.** The layers come from artifacts checked into `src/content/work/<slug>/`, each with a zod schema
   (`src/content/teardown.ts`). `scripts/verify-teardown.ts` runs in `prebuild` and fails the build on a malformed file or any
   disagreement with the claims ledger or the case study's frontmatter. Only identity fields are required; a missing field hides
   its layer. Nothing is invented or defaulted.
2. **A pure timeline.** `teardownState(progress)` (`src/engine/motion/teardown-state.ts`) returns every element's value for a
   progress 0..1, from keyframe tracks (`keyframes.ts`) with per-segment easing. States each carry one meaning from the motion
   vocabulary, and neighbouring transition windows overlap by 15% so nothing waits for the last thing to finish. It has no DOM and
   no clock, so it is unit-tested at every key, boundary and overlap, for continuity, and for reversibility.
3. **A static document first.** `components/case/Teardown.astro` renders all states as a vertical document with every number
   visible. That is the complete experience for no JS, reduced motion, tier C, `/plain` and assistive tech. On tier A/B a lazy
   script reads that markup (`data-td-*`), builds an `aria-hidden` sticky stage, and visually hides the document.
4. **No new loop.** The stage subscribes to `input/scroll.ts` and the shared scheduler. Scroll sets a target; a critically damped
   spring (`spring.ts`, solved exactly, no overshoot from rest) glides the displayed progress to it, and sleeps when settled, so an
   idle page renders 0 frames. Geometry is measured on load and on resize and cached; a frame never reads layout. It animates
   transform, opacity and clip-path only, never WebGL. The lazy chunk has its own size-limit entry (6 KB gz for MalTrace).

To reuse it, write the artifacts and a schema, a layer list and state table, then a stage builder that maps layers onto the same
`Layers` shape; keep the static document as the source the stage reads.

## Where it lives
`src/engine/motion/` (next to the scroll story), not `src/engine/fx/`. The 4 KB gzip budget on `fx/` belongs to the atmosphere
layer (ADR-0012) and a case-study scroll story is not one. Putting it there would have meant either breaking that budget or
raising it.

## Amendment 2026-10-06: a scoped exception to "DOM only", and the rest of the rebuild
- **One 2D canvas for the stream.** The API stream is a single Canvas2D layer inside the stage, not WebGL. It draws at most 600
  points, and each API's share of them is proportional to its real call count (largest remainder, so the shares sum to exactly 600;
  the 13th lane is everything outside the top 12, api_total minus their sum). The points carry meaning (flow volume): in DISTILL
  they are vacuumed into the 54-cell matrix, in DECIDE funnelled into the model, and they are gone before the stillness. Positions
  are a pure function of progress (`stream.ts`), the camera transform is applied to the canvas context, and the canvas draws on
  the same scheduler subscription, so it sleeps when the scroll stops. It exists only on tier A/B; reduced motion, tier C and
  `/plain` have no canvas and show the top-12 bars as a table. This is the only canvas; a test pins it at one and at 2D.
- **Stillness.** In DECIDE the funnel finishes, the camera stops, and for a beat nothing moves. Then the verdict stamps once,
  fast. A test asserts that while it stamps no other track changes.
- **Gyro adds depth only**, at most 6 px, to the slabs (more for the deeper ones) and the ATT&CK nodes. It never changes progress or
  navigation: scroll owns the story. Events set a goal and the scheduler eases to it, then sleeps.
- **One prediction, one number.** The verdict is the ledger's `maltrace-confidence`; the build fails unless the claim value, its
  display and the SHAP artifact's confidence agree.
- **No tactic grouping** of the ATT&CK nodes: several of these techniques belong to more than one tactic, so the nodes are a plain
  ordered grid.
- **Budget:** the teardown chunk limit is 6 KB gzipped (was 5), for the spring, the keyframes and the canvas. Pre-LCP stays under 20 KB.

## Rejected
- **WebGL.** The teardown is a diagram a visitor must read, so it is DOM (ADR-0005), plus the one 2D canvas above.
- **An animation library or a loop of its own** (ADR-0014).
- **Timed animation.** Everything is a function of scroll position, so it can be scrubbed, reversed and tested without a clock.
- **Hiding the document with `display: none` or `aria-hidden`.** The static document stays available to assistive tech and
  keyboard users; only the visual stage is `aria-hidden`.
- **Reading numbers from copy.** Counts come from the claims ledger or the artifacts. The 46/8 split is two ledger claims whose
  sum the build checks against the 54 total.

## Why
The point of the page is that its numbers are evidence. A scroll story that can be generated only from checked artifacts, fails
the build when they disagree, and falls back to a plain document is the same discipline the site applies to its claims.
