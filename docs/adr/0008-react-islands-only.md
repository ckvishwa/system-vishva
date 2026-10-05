# ADR-0008 React only for stateful islands

Status: accepted · Date: 2026-10-04

## Decision
React for SystemsGraph only. ReleaseGateDemo is vanilla TypeScript (decided 2026-10-05): its rule is a pure module in
`src/engine/release-gate.ts` and its UI is four native selects, so no framework is needed.

## Rejected
React for everything.

## Why
Islands architecture keeps pages static.
