# MalTrace: teardown storyboard

Every state must communicate one of: flow, state, dependency, cause, hierarchy, change. If it does none, delete it.

The case study opens with the investigation prose and the recorded sample (file, size, SHA-256, SHA-1, MD5), then the
**teardown**: a sticky stage about 700vh tall in which one object, the sample, is transformed from a sealed file into a finished
investigation while the camera follows the scroll. Elements persist and transform; nothing is swapped for a different card.
Every value is a keyframe track over one progress (`TRACKS` in `src/engine/motion/teardown-state.ts`), so scrolling back
reassembles exactly what scrolling forward took apart.

## Inputs, all real

| File | Provides |
| --- | --- |
| `src/content/work/maltrace/maltrace-teardown.json` | file name, size and hashes; PE sections with sizes and entropy; API total and top 12; process count; signatures; ATT&CK ids (CAPE analysis 15) |
| `src/content/work/maltrace/shap_wannacry_exe.json` | confidence, malware probability, SHAP base value, per-feature SHAP contributions |
| `src/content/work/maltrace/maltrace-features.json` | the eight static PE feature names the README lists |
| `src/content/claims/claims.yaml` | 94,958 API calls, the one confidence figure (`maltrace-confidence`), 54 = 46 dynamic + 8 static |

The build fails if analysis_id is not 15, if api_total differs from the ledger, if the teardown's SHA-256 differs from
`sample.sha256` in `maltrace.mdx`, if the SHAP sample is not `wannacry.exe`, or if the claim value, the claim display and the SHAP
confidence are not one and the same number. A field that is absent hides its layer. Nothing is filled in.

## Timing

Eight states, each `1/8` of the scroll. State k's entrance is a window centred on the boundary k/8, one state plus 15% long, so
neighbouring windows overlap by 15% of a state and nothing waits for the previous thing to finish. Segments ease in-out cubic
unless noted. Displayed progress follows scroll on a critically damped spring.

| # | State | Meaning | What happens |
| --- | --- | --- | --- |
| 0 | SEALED | state | A near-empty frame: "Analysis 15", and the file block centred as one solid block, `wannacry.exe, 3,514,368 bytes`. The camera pushes in (scale 0.8 to 1). The SHA-256 settles character by character, left to right, from a scramble to the real hash. |
| 1 | CRACK | hierarchy | The block splits into its PE sections as stacked slabs, a quarter of the way open. Height is proportional to section size (8px floor; real sizes are printed). Fill density follows entropy. Entropy above 7.0 reads HIGH ENTROPY, never "packed". |
| 2 | DETONATE | flow | The slabs ease apart and aside. The top 12 API calls run beside them as bars and the total counts up to the ledger's 94,958. On the opposite side, `process_count` nodes (17) grow. The teardown data has no parent/child links, so there are no edges and no invented tree. |
| 3 | DISTILL | cause | Everything is pulled inward: the slabs flatten, the bars retract, the process nodes gather. The 54-cell matrix assembles: 46 dynamic behavioral, 8 static PE (info colour). |
| 4 | DECIDE | change | The matrix funnels into the model node (the pipeline's Random forest) as the camera pushes in. **Stillness**: everything stops. Then the verdict stamps once, fast, wiped clear of its redaction bar: the ledger's "95% malicious confidence on this sample", with "A single-sample prediction, not model accuracy". It is the page's one inverted block. While it stamps, no other value moves (a unit test asserts it). |
| 5 | EXPLAIN | cause | The verdict docks at the top. The node opens back out into the ten real SHAP contributions on a central axis: toward malicious in `--c-risk`, away in `--c-system`. Bar lengths are proportional to the real values; the base value is printed. |
| 6 | MAP | dependency | The bars hand over to the 13 ATT&CK techniques, which grow out of the bar ends into a plain ordered grid. They are not grouped by tactic: several of these techniques belong to more than one tactic, so a grouping would be a guess. Each links to attack.mitre.org. |
| 7 | PULL-BACK | flow | The camera zooms out (scale 1 to 0.62) and the investigation chain is what is left to read: the pipeline's seven stages, each with its real number (hash, process count, API total, feature count, verdict, top SHAP feature, technique count). |

## Layout

- **Desktop:** slabs on the left with labels beside them, the API stream in the middle, the process nodes on the right; later
  layers use the full width.
- **Under 720px:** the exploded view runs vertically with each label directly below its slab; the API stream sits below the
  slabs and the process nodes beside them.

## Fallback

Reduced motion, tier C, `/plain`, no JS and screen readers get no sticky stage. `Teardown.astro` renders all eight states as a
static vertical document in reading order with every number visible (tables for sections, API calls, SHAP, signatures, the
chain). On tier A/B the lazy script reads that same markup, builds an `aria-hidden` stage and visually hides the document (it
reappears if a link inside it takes keyboard focus). The animated stage is never the only place a fact lives.

## Engineering

Scroll sets a target; a critically damped spring glides what is shown to it, and sleeps when settled, so an idle page renders 0
frames. Geometry is measured on load and on resize (debounced ResizeObserver), never inside a frame. Only transform, opacity
and clip-path animate; sizes are set on resize and slabs resize with scaleY. The stage has `contain: layout paint`, and
`will-change` only while it is on screen. Counters write text only when the integer changes. The lazy chunk is size-limited to 6 KB gzipped.
