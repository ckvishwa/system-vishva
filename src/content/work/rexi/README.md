# Rexi: captured interpreter outputs (beat 5)

Status: TODO. Waiting on real logs from the owner. Nothing here may be invented or edited by hand.

Beat 5 of the scroll story ("model proposal vs server authorization", docs/storyboards/rexi.md) replays
real captured interpreter outputs. Each capture needs:

- the raw interpreter output as the model produced it (the proposal), verbatim
- the server's decision: `VALIDATED` or `REJECTED`, and the rule that decided it
- where it came from: log file, commit or run id, and capture date (the evidence link)

Store them as `captures.yaml` in this folder. The glob loader for `work` only reads `*.mdx`, so this
folder does not create a route. Until the file exists, the story shows a clearly marked placeholder.
