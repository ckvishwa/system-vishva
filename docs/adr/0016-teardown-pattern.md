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
   transform, opacity and clip-path only, never WebGL. The lazy chunk has its own size-limit entry (see the budget exception below).

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
- **Budget:** the teardown chunk limit became 6 KB gzipped (was 5), for the spring, the keyframes and the canvas. It is raised again below. Pre-LCP stays under 20 KB.

## Amendment 2026-10-07: the CAD exploded view, and a budget exception
The visual and narrative model was replaced with a CAD-style exploded view and nine states (SEALED, X-RAY, EXPLODE, DETONATE,
DISTILL, DECIDE, VERDICT, EXPLAIN, MAP; the old PULL-BACK is the final portion of MAP). The spring, the scheduler, the keyframe
interpolator, the stream canvas, gyro and the evidence gates are unchanged.

- **CSS 3D, once.** `perspective` is on `.td-world` (the stage's world, the parent of the slab group) and `preserve-3d` only on the
  slab group; slabs are `backface-visibility: hidden`. Each slab's transform comes from its index and one explode amount
  (`explode.ts`): even left/forward, odd right/back, tilt at most 12 degrees, never keyed on a section name.
- **Flat annotations over 3D slabs.** Callouts, leader lines and the alignment rail are 2D. Their anchors are the slabs' 3D points
  projected through the same perspective the browser uses (`slabPoint`, `project`), unit-tested against a hand-computed CSS transform.
- **The stream passes through the gaps** along the camera axis. A point's column is its API and its gap is its index, so nothing
  implies an API belongs to a PE section.
- **X-RAY does not claim positions the data lacks.** Raw offsets and virtual addresses are not in the CAPE extract; the schema
  fields are optional, the dependent annotations hide, and the bands are equal. With real offsets for every section the bands sit
  at offset / file size. Offsets are never computed from cumulative sizes.
- **VERDICT is absolute stillness** for the whole state, the one deliberate exception to the 15% overlap rule.
- **A state moves during its own span** (its window is the state widened by half the overlap), so EXPLODE does not start lifting
  inside X-RAY.

### Budget exception: teardown chunk 6,000 B to 6,800 B gzipped
| | |
| --- | --- |
| Previous limit | 6,000 B (size-limit, gzipped) |
| New limit | **6,800 B** |
| Measured size | 6,473 B (the previous implementation measured 5,985 B) |
| Delta | +488 B, +8.2% |

Why the extra bytes are justified: they buy the exploded-view geometry (slab transforms, projection, annotation anchors, the band
layout that uses real offsets when they exist), the annotation overlay with leader lines and the rail, the stream through the
gaps, and the two extra states with the stillness. That is the signature visual of the MalTrace case study. The chunk is lazy
(fetched only on the MalTrace case study, never under reduced motion or tier C) and does not count toward the pre-LCP budget, which
stays under 20 KB. Before asking for room the code was deduplicated: the stage reads one payload built by `Teardown.astro` instead of
re-reading and re-formatting the document, the state object is built from the track names, and the per-API bar rows and two captions
were dropped, which took the first working build from 7.4 KB to 6.5 KB.

**Future growth beyond 6.8 KB requires another explicit decision.** No other budget changed.

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
