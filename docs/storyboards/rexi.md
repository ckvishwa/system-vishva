# Rexi — scroll storyboard

Every beat must communicate one of: flow, state, dependency, cause, hierarchy, change. If it does none, delete it.

| Beat | Scroll % | On screen | What animates | Intent |
| --- | --- | --- | --- | --- |
| 1 | 0 | "Voice AI without giving the model control." | Mask reveal of the thesis | state |
| 2 | 10–40 | Pipeline: Phone → SIP → VAD → STT | Nodes activate in order, line traces between | flow |
| 3 | 40–60 | Interpreter → FSM → Pricing | Same, interpreter output shown as muted "proposal" | dependency |
| 4 | 60–75 | "LLMs are good at language. They are bad places to store business truth." | Hard cut, no motion | cause |
| 5 | 75–90 | Model proposal vs server authorization, side by side | Proposal stamped VALIDATED / REJECTED | change |
| 6 | 90–100 | Metrics from the claims ledger | Count-up, evidence links | state |

Open: which real interpreter outputs (captured logs) to replay in beat 5? Store them in src/content/work/rexi/ with their source.
