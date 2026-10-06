# MalTrace: teardown storyboard

Every state must communicate one of: flow, state, dependency, cause, hierarchy, change. If it does none, delete it.

The case study opens with the investigation prose and the recorded sample (file, size, SHA-256, SHA-1, MD5), then the
**teardown**: a sticky stage about 600vh tall, where the sample is dismantled layer by layer as the page scrolls. Scrolling back
reassembles it exactly, because every layer is a pure function of progress (`teardownState` in
`src/engine/motion/teardown-state.ts`).

Inputs, all real:

| File | Provides |
| --- | --- |
| `src/content/work/maltrace/maltrace-teardown.json` | file name, size and hashes; PE sections with sizes and entropy; API total and top 12; process count; signatures; ATT&CK ids (CAPE analysis 15) |
| `src/content/work/maltrace/shap_wannacry_exe.json` | confidence, malware probability, SHAP base value, per-feature SHAP contributions |
| `src/content/work/maltrace/maltrace-features.json` | the eight static PE feature names the README lists |
| `src/content/claims/claims.yaml` | 94,958 API calls, 95% confidence, 54 = 46 dynamic + 8 static |

The build fails if analysis_id is not 15, if api_total differs from the ledger claim, if the teardown's SHA-256 differs from
`sample.sha256` in `maltrace.mdx`, if the SHAP sample is not `wannacry.exe`, or if the SHAP confidence is not 95.0.
A field that is absent hides its layer. Nothing is filled in.

## The seven states

Each state owns one seventh of the stage's scroll travel. `p` is progress 0..1; the ranges below are in sevenths.

| # | State | Scroll range | Meaning | What happens |
| --- | --- | --- | --- | --- |
| 0 | SEALED | 0 to 1/7 | state | One solid block, `wannacry.exe, 3,514,368 bytes`. The SHA-256 settles in over the first half of the state (clip-path reveal). |
| 1 | CRACK | 1/7 to 2/7 | hierarchy | The block splits into its PE sections as stacked slabs, a quarter of the way open. Height is proportional to section size (with an 8px floor so a 28 KB slab stays a visible box; the real sizes are printed). Fill density follows entropy. Each slab is labelled with name, size and entropy. Entropy above 7.0 reads `HIGH ENTROPY`. It never says "packed". |
| 2 | DETONATE | 2/7 to 3/7 | flow | The slabs pull fully apart. The top 12 API calls appear beside them as horizontal bars with counts, and the total counts up to 94,958. |
| 3 | DISTILL | 3/7 to 4/7 | cause | The slabs and stream fall away; 54 cells assemble: 46 dynamic behavioral (neutral) and 8 static PE (info colour, titled with their README names). |
| 4 | DECIDE | 4/7 to 5/7 | change | The cells converge into one model node (the pipeline's Random forest). The verdict is revealed by a wiping redaction bar: **95% malicious confidence on this sample**, with "A single-sample prediction, not model accuracy." It is the page's one inverted block. |
| 5 | EXPLAIN | 5/7 to 6/7 | cause | The verdict docks. Ten SHAP contributions grow as bars from a zero axis: toward malicious in `--c-risk`, away from it in `--c-system`. Lengths are proportional to the real SHAP values; the base value is printed. |
| 6 | MAP | 6/7 to 1 | dependency | The 13 ATT&CK technique ids lock in one by one as hard-edged tags, each linking to attack.mitre.org. |

Within a state, layers cross-fade a few percent either side of the boundary so nothing jumps; the unit tests assert continuity
at 7000 scroll positions.

## Layout

- **Desktop:** slabs on the left with labels beside them; the API stream on the right; the grid, model, verdict, explanation
  and tags use the full width.
- **Under 720px:** the same stack, exploding downward, with each label directly below its slab; the API stream sits below the slabs.

## Fallback

Reduced motion, tier C, `/plain`, no JS and screen readers get no sticky stage. `Teardown.astro` renders all seven states as a
static vertical document in reading order, with every number visible (tables for sections, API calls, SHAP, signatures). On
tier A/B the lazy script reads that same markup, builds an `aria-hidden` stage, and visually hides the document (it reappears
if a link inside it takes keyboard focus). The animated stage is therefore never the only place any fact lives.

## Engineering

Progress comes from `input/scroll.ts` and the shared scheduler. Each scroll or resize draws one frame and returns "not dirty",
so a page that has stopped scrolling renders 0 frames. Only transform, opacity and clip-path animate. DOM only: no WebGL, no
animation library. The lazy chunk is about 3.5 KB gzipped against a 5 KB limit enforced by `.size-limit.json`.
