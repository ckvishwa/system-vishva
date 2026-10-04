# ADR-0013 Brutalist telemetry layer

Status: accepted · Date: 2026-10-04

## Decision
Phase 1.5 adds density, raw structure and the security feel, taken from brutalist dashboards, terminal portfolios and
cyberpunk CSS frameworks, but **only where it shows something real**. Every number, status and command output comes from the
content collections, `build.json` or the live browser. Nothing is typed in to look technical.

## What is taken

| # | Pattern | Rule |
| --- | --- | --- |
| T1 | Spec-sheet cells | `Cell`: 1px ruled box, mono label top-left, large tabular-nums value, optional status chip. Cells tile edge to edge with shared borders, no gaps, no floating cards. Used for metrics, status data and the homepage strip. Chips are real state: PASS/BLOCK, VERIFIED/UNVERIFIED. |
| T2 | Hard offset shadow | `4px 4px 0 var(--c-text)` with a matching translate on hover/focus. **Interactive elements only** (buttons, links styled as blocks, records). It is an affordance, so it never appears on static content. Snaps, no easing. Reduced motion and tier C: no translate, the shadow changes colour. |
| T3 | One inverted block | Off-white background, black text, for the single most important statement. **At most one per page.** Home: the first principle. Rexi: the beat 4 line. Inversion means "this matters", so it is never decoration. |
| T4 | Grid coordinates | Tiny mono column indices (00 04 08 12 ...) along the top of the hero and /status, counting cells of the 48px grid drawn behind the page, so each number sits on a real line. |
| T5 | Structural weight | A 4px rule opens each major section; 1px everywhere else. |
| T6 | Numbers | `font-variant-numeric: tabular-nums` on every metric, timecode, table and count. |
| T7 | Command terminal | Opens with `/` or `` ` `` (desktop) or the nav item (mobile). Lazy-loaded on first open, so pre-LCP JS is unchanged; budget 6 KB gz. Commands: help, ls, open, cat claims, whoami, status, lab, mode plain, history, clear, exit. Output is read from `/terminal.json`, generated at build from the collections and `build.json`. `role="dialog"`, focus trap, page behind inert, `aria-live="polite"` output, Esc returns focus. Instant output: no typing animation, no boot sequence, no window chrome. The prompt shows the real route. |
| T8 | CSS `@layer` | `reset, tokens, base, components, fx`. `fx` loads last and is trivially removable: delete its import and only the atmosphere goes. |
| T9 | Effects by data attribute | `data-fx="redact"`, `data-fx="decrypt"`, so content files declare intent instead of reaching for classes. |
| T10 | Container queries | `Cell` and `SystemRecord` adapt to their column, not the viewport. |

## What is rejected (also in CLAUDE.md)
- Neon glow and text-glow
- Cyan, magenta or yellow cyberpunk palettes
- Terminal window chrome dots
- "hack the planet", "EXECUTE", "TERMINATE" copy
- Datastream or falling-character effects
- Icon packs: no icons, type and rules only

## New surfaces
- `/status`: a dense system-status page built from cells. Gate panel, claims ledger, this visitor's render tier, last 15 commits,
  lab processes with the DORMANT rule. All data real, generated at build; a panel whose data is missing is omitted.
- Homepage telemetry strip: one row of cells under the hero (commit, gate, pages built, tests passing, JS pre-LCP), linking to /status.

## Data honesty
`scripts/build-manifest.ts` reads vitest's JSON reporter and size-limit's JSON when they exist, counts pages from the source and
reads git. Test and size numbers come from the most recent run, so each shows when it was measured. The gate script builds twice so
a deployed build includes the size figures.

## Consequences
- Case-study metrics now show their real claim state (UNVERIFIED in the risk colour until an evidence link exists). The BLOCK
  verdict explains itself on the page that carries the numbers.
- `keys.ts` is the single keyboard-shortcut listener, for the terminal only. Effects still read input only through
  pointer.ts, gyro.ts and scroll.ts.
- GSAP's ScrollTrigger kept an idle case study rendering ~60 frames a second. Phase 1.5 starved its loops with a workaround; ADR-0014
  removes ScrollTrigger and GSAP entirely, so no workaround remains.
