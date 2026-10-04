# ADR-0014 Scroll story without GSAP

Status: accepted · Date: 2026-10-04 · Supersedes ADR-0004

## Decision
The case-study scroll story runs on `src/engine/input/scroll.ts` and the shared scheduler. No animation library, and GSAP is
removed from the dependencies.

On each scroll or viewport resize the story wakes its scheduler subscription. The subscription measures each beat once with
`getBoundingClientRect`, turns that into a 0..1 progress (`sectionProgress`: 0 when the beat's top reaches 75% of the viewport,
1 when its bottom reaches 45%), lights pipeline nodes and draws connectors from that progress, then returns "not dirty" and sleeps.
The progress, node-activation and trace maths are pure functions in `src/engine/motion/story.ts`, unit-tested.

## Rejected
- **GSAP + ScrollTrigger** (ADR-0004).
- Keeping ScrollTrigger and starving its loops while it initialises (tried in Phase 1.5).

## Why
- **One frame loop (ADR-0006, ARD §5).** ScrollTrigger keeps an idle page busy three ways: a perpetual `requestAnimationFrame`
  loop (a repaint workaround), GSAP's ticker, and a 250 ms `setInterval` that schedules a frame each time. An idle case study
  rendered ~60 frames a second. Starving those loops worked, but a workaround that patches `requestAnimationFrame` and
  `setInterval` breaks the single-loop rule in spirit and would fail again on any library upgrade.
- **Cost.** About 25 KB gzipped of JavaScript for what is a progress calculation and some class toggles.
- **The story never needed an animation engine.** Every beat is real HTML in reading order; the script only toggles classes
  that CSS transitions already animate.

## Consequences
- An idle case study renders 0 frames, checked by the same e2e test shape as the homepage.
- Scroll updates are finite: one scheduler frame per scroll or resize event, then sleep.
- `input/scroll.ts` gains `trackViewport` (resize), still the only place those listeners live.
- Total JS on case studies is lower; the pre-LCP budget now includes the story script on case-study pages (it is small).
- ADR-0004 is superseded. References in the ARD and CLAUDE.md are updated.
