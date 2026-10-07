# MalTrace: teardown storyboard

Every state must communicate one of: flow, state, dependency, cause, hierarchy, change. If it does none, delete it.

The case study opens with the investigation prose and the recorded sample (file, size, SHA-256, SHA-1, MD5), then the
**teardown**: a sticky stage about 970vh tall on desktop (835vh on a phone) in which one object, the sample, is shown as a CAD exploded view and then taken
through the whole investigation while the camera follows the scroll. Elements persist and transform; nothing is swapped for a
different card. Every value is a keyframe track over one progress (`TRACKS` in `src/engine/motion/teardown-state.ts`), so
scrolling back reassembles exactly what scrolling forward took apart (a unit test and an e2e test assert it).

## Inputs, all real

| File | Provides |
| --- | --- |
| `src/content/work/maltrace/maltrace-teardown.json` | file name, size and hashes; PE sections with raw size, virtual size and entropy; API total and top 12; process count; signatures; ATT&CK ids (CAPE analysis 15) |
| `src/content/work/maltrace/shap_wannacry_exe.json` | confidence, malware probability, SHAP base value, per-feature SHAP contributions |
| `src/content/work/maltrace/maltrace-features.json` | the eight static PE feature names the README lists |
| `src/content/claims/claims.yaml` | 94,958 API calls, the one confidence figure (`maltrace-confidence`), 54 = 46 dynamic + 8 static |

The build fails if analysis_id is not 15, if api_total differs from the ledger, if the teardown's SHA-256 differs from
`sample.sha256` in `maltrace.mdx`, if the SHAP sample is not `wannacry.exe`, or if the claim value, the claim display and the SHAP
confidence are not one and the same number. A field that is absent hides its layer. Nothing is filled in.

**Not in the data yet:** raw offsets and virtual addresses. The schema fields `raw_offset` and `virtual_address` are optional.
Until CAPE supplies them, the annotation lines and table columns that depend on them are hidden, and X-RAY draws equal bands:
it does not claim proportional raw-offset positioning and never derives offsets from cumulative section sizes. When every section
has a raw offset, the bands sit at offset / file size.

## Pacing: cinematic dwell

The nine states do not each consume the same scroll. A **dwell** is scroll distance where the picture stays exactly as it is, so
the hero frames can be read. It is not a timed pause and not another animation: if the visitor stops scrolling inside a dwell
there is nothing to run (0 frames once the spring settles), and scrolling back through it is the same mapping in reverse.

`storyProgress(raw)` in `src/engine/motion/story-map.ts` is the whole mechanism, one pure piecewise function from raw scroll
progress to the progress the timeline is drawn at: a *move* advances the mapped progress, a *hold* keeps it constant, and the next
move advances it again. The spring that smooths the scroll acts on the raw progress, so a hold is entered and left smoothly. The
stage's height is the sum of the segment lengths, set from the same table.

| Beat | Desktop dwell | Phone dwell | What is held |
| --- | --- | --- | --- |
| SEALED | 0.15 vp | 0.10 vp | the opaque file, camera in, hash settled |
| **X-RAY** | 0.55 vp | 0.45 vp | the intact translucent file, sections inside it, one scan finished |
| **EXPLODE** | 1.0 vp | 0.68 vp | the signature frame: separated, rail drawn, leaders extended, labels resolved |
| **DETONATE** | 0.9 vp | 0.68 vp | the exploded geometry fixed; the stream runs with the scroll position; 94,958 and 17 processes readable |
| DISTILL | 0.2 vp | 0.12 vp | the 54 cells assembled |
| **VERDICT** | 1.0 vp | 0.7 vp | absolute stillness, after one stamp at the start of the beat |
| EXPLAIN | 0.2 vp | 0.12 vp | the SHAP bars out |
| **MAP** | 0.6 vp | 0.4 vp | every ATT&CK node out, before the pull-back |

The remaining scroll is the moves between holds, the same on both profiles (4.1 vp). Total story length: 8.7 vp on desktop and
7.35 vp on a phone (84.5% of it). One move is not continuous: after the VERDICT hold the progress goes from 6.2 to 7 states.
Nothing moves anywhere in that range (it is the stillness), so the picture does not change and the label advances only when
EXPLAIN really starts. DECIDE has no dwell of its own.

All secondary motion is derived from scroll, never time: the X-RAY scan sweeps once with the local scroll; the EXPLODE
sub-beats (separate, rail, leaders, labels) are consecutive ranges of the move before the hold; the DETONATE points travel through
the held gaps as the scroll position changes inside the hold (`flow = raw * 15`).

## Timing

Nine states, each `1/9` of the scroll. A state's motion happens during that state: its window is the state widened by half a
15% overlap at each end, so neighbouring windows overlap by 15% of a state and nothing waits for the previous thing to finish.
Segments ease in-out cubic unless noted. Displayed progress follows scroll on a critically damped spring.

| # | State | Meaning | What happens |
| --- | --- | --- | --- |
| 0 | SEALED | state | One opaque `wannacry.exe` object, "Analysis 15". The camera pushes in (scale 0.8 to 1). The SHA-256 settles character by character, left to right, then a short reading plateau. |
| 1 | X-RAY | hierarchy | The SAME object becomes semi-transparent. The PE sections appear inside the shell as stacked bands, fill density following entropy, and one scan sweeps the file once (tied to the scroll). Nothing separates. The intact file is then held. |
| 2 | EXPLODE | hierarchy | The shell becomes a faint reference envelope. The real sections lift out of it like components in a CAD exploded view: CSS 3D, derived from each slab's index (even left/forward, odd right/back), tilted at most 12 degrees. Then, in order, the 1px alignment rail draws down the exploded object, the leader lines extend, and the flat 2D annotations resolve at the slabs' projected anchors. The finished frame is held. |
| 3 | DETONATE | flow | The exploded slabs stay. The 2D API stream (at most 600 points, each API's share proportional to its real count) flies along the camera axis through the gaps, driven by the scroll position (also inside the hold). No API is tied to a PE section. The total resolves to the ledger's 94,958. The 17 process nodes appear beside the stack; there are no edges, since the data has no parent/child links. |
| 4 | DISTILL | cause | The slabs rotate back toward one plane and flatten; the stream and the structure collapse into the 54 cells: 46 dynamic behavioral and 8 static PE (info colour). |
| 5 | DECIDE | dependency | The 54 cells funnel into the model node (the pipeline's Random forest) as the camera pushes in. |
| 6 | VERDICT | change | **Absolute stillness**: the verdict stamps once, fast, at the start of the beat, wiped clear of its redaction bar; for the rest of the state nothing changes at all: the ledger's "95% malicious confidence on this sample", with "A single-sample prediction, not model accuracy". It is the page's one inverted block. A unit test asserts that no other track moves anywhere in this state. |
| 7 | EXPLAIN | cause | The verdict docks at the top. The node opens back out into the ten real SHAP contributions on a central axis: toward malicious in `--c-risk`, away in `--c-system`. Lengths are proportional to the real values; the base value is printed. |
| 8 | MAP | dependency | The bars hand over to the 13 ATT&CK techniques, which grow out of the bar ends into a plain ordered grid (not grouped by tactic: several of these techniques belong to more than one, so a grouping would be a guess). Each links to attack.mitre.org. In the final portion, the camera pulls back (scale 1 to 0.62) to reveal the investigation chain: the pipeline's seven stages, each with its real number. |

## Annotations

Flat 2D overlay, never inside the 3D group. Only real data, one line each, a line appearing only when the data has it: section
ID (its position in the section table), name, raw offset, raw size, virtual address, virtual size, entropy. Entropy above 7.0
reads HIGH ENTROPY; the stage never says "packed".

## Layout

- **Desktop:** the stack is centred. Annotations alternate left and right margins level with their slab; leader lines run from the
  label's inner edge to the slab's projected anchor. The process nodes and the API total sit bottom-left and bottom-centre.
- **Under 720px:** the same shell, slabs and rail, 76% of the stage wide. The explosion runs vertically with shallow sideways and
  depth separation and about half the tilt. Annotations alternate left and right, each directly below its slab, always inside the
  viewport margins. The stream passes vertically through the gaps. The API total sits bottom-left and the process nodes bottom-right.
  No horizontal overflow; safe-area insets are respected. Same real numbers, same nine states.

## Fallback

Reduced motion, tier C, `/plain`, no JS and screen readers get no sticky stage and no canvas. `Teardown.astro` renders all nine
states as a static vertical document in reading order with every number visible (tables for sections, API calls, SHAP, signatures,
the chain). On tier A/B the lazy script reads one payload built from the same data, builds an `aria-hidden` stage and visually hides
the document (it reappears if a link inside it takes keyboard focus). The animated stage is never the only place a fact lives.

## Engineering

Scroll sets a target; a critically damped spring glides what is shown to it and sleeps when settled, so an idle page renders 0
frames. Geometry is measured on load and on resize (debounced ResizeObserver), never inside a frame. Only transform, opacity and
clip-path animate; sizes are set on resize and slabs resize with scaleY. The stage has `contain: layout paint`, and `will-change`
only while it is on screen. Counters write text only when the integer changes. Gyro adds at most 6 px of depth to the slabs and the
ATT&CK nodes and never touches progress. The lazy chunk is size-limited to 6.8 KB gzipped and measures about 6.15 KB (see ADR-0016): the timeline's keyframe tracks are data in the
page payload, not code in the script. A held frame contains nothing from the next state (a unit test asserts every later layer is exactly
zero at each hold), and a layer at its terminal zero is also `visibility: hidden`.

Screenshots of X-RAY, EXPLODE and DETONATE while moving, and of the centre of each hero dwell (X-RAY, EXPLODE, DETONATE,
VERDICT, MAP), at 1280 and 390 px in Chromium and WebKit are produced by `tests/e2e/teardown-shots.spec.ts` (CI uploads them as the
`teardown-shots` artifact; `docs/teardown-shots/` holds the Chromium set).
