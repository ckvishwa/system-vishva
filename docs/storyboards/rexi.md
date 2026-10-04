# Rexi — scroll storyboard

Every beat must communicate one of: flow, state, dependency, cause, hierarchy, change. If it does none, delete it.

Source of truth for the pipeline is `pipeline:` in `src/content/work/rexi.mdx`
(Call, VAD, STT, Interpreter, FSM, Pricing, Confirm, POS). The groups below are the `story:` field in the same file.
Node numbers are the ones printed on the diagram.

| Beat | Scroll % | On screen | What animates | Intent |
| --- | --- | --- | --- | --- |
| 1 | 0 | "Voice AI without giving the model control." (the thesis) | Redaction reveal of the thesis (atmosphere layer, E3) | state |
| 2 | 10–40 | Pipeline nodes 01–03: Call, VAD, STT | Nodes activate in order, connectors trace between | flow |
| 3 | 40–60 | Nodes 04–06: Interpreter, FSM, Pricing; then 07–08, Confirm and POS | Same. Interpreter is drawn dashed and muted, tagged "proposal", and never turns the pass colour | dependency |
| 4 | 60–75 | "LLMs are good at language. They are bad places to store business truth." | Stepped 400 ms redaction wipe (approved in place of a pure hard cut, see ADR-0012). No other motion | cause |
| 5 | 75–90 | Model proposal vs server authorization, side by side | Proposal stamped VALIDATED / REJECTED. **Placeholder until real captures exist** | change |
| 6 | 90–100 | Metrics from the claims ledger | Count-up, evidence links, final value already in the HTML | state |

Scroll percentages are guidance. In code each pipeline beat is a section whose own scroll progress lights its nodes, so the
diagram stays in step with the reading position and runs in reverse when scrolling back.

Nodes 07–08 (Confirm, POS) are not named in a beat of their own; they light at the end of beat 3. TODO: confirm this placement.

## Open

Beat 5 needs real interpreter outputs (captured logs) to replay. They go in `src/content/work/rexi/captures.yaml`
with their source; see the README in that folder for the format. Nothing is invented in the meantime.

## Accessibility

Every beat is real HTML in reading order. With no JS, reduced motion or tier C the page shows its final state: every node
lit, every connector drawn, metrics at their final values. The scroll script only toggles classes.
