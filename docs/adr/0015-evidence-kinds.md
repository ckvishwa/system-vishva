# ADR-0015 Evidence kinds

Status: accepted · Date: 2026-10-05 · Extends ADR-0010

## Decision
Each claim in `src/content/claims/claims.yaml` may declare `evidenceKind`:

| Kind | Meaning | `evidence` | Shown as |
| --- | --- | --- | --- |
| `public` | A public artifact on another host (a pinned repo file, a report) | `https://…` | `VERIFIED`, linked |
| `self-hosted` | A file this site serves, for sources that must stay private. Sanitised output only: a header line (private repo, commit, date, command) and the raw last line of the tool's output | `/evidence/…` | `VERIFIED`, linked, with "source: private repo, output published" |
| `on-request` | No public artifact exists. The owner can supply it on request | `null` | an "available on request" chip in `--c-muted`; `ON REQUEST` in `--c-info` on /status and in the terminal, never red |

If `evidenceKind` is omitted it is inferred: a `/path` is `self-hosted`, a URL is `public`, and `null` is `unverified`.
Kind and evidence must agree (`on-request` with a link, or `self-hosted` without a `/path`, fails the gate).

The strict gate (`scripts/verify-claims.ts --strict`) treats `on-request` as allowed. `/status` and the claims report count it
separately from verified. `unverified` still blocks.

`--online` makes the gate check what it claims to: every `public` URL must answer 200 to an anonymous request (a 404, a network
error, or a redirect to a login page fails; a private repository answers 404 anonymously), and every `self-hosted` file must
exist in `dist/`. It runs after the final build in CI (`release-gate.yml`) and in production, and is off for local runs and
previews. The checks are unit-tested with a mocked `fetch`.

## Rejected
- Counting `on-request` as verified. It has no artifact a visitor can open.
- Showing it as red UNVERIFIED. The number was measured, it just has no public file, and red means "risk" here.
- Publishing raw test output. Only the summary line and a provenance header leave the private repository.

## Why
A private repository cannot be linked, but a portfolio can still be honest about it: say what is public, what is published
as sanitised output, and what is only available on request, and make the gate prove the first two.
