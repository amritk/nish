---
name: WP31 — ranged integers
overview: integer<Lo, Hi> and its proofs landed; three refinements are deferred until a program or measurement asks for them.
roadmap: docs/roadmap/wp31-ranged-integers.md
spec: docs/wp31-ranged-integers.md
priority: 80
labels: [deferred]
issue: 1863
stages:
  - id: w5-lower-bound
    title: WP31 W5 — a lower-bound fact family, i >= n
    goal: bounds.ts records a fact i >= n for n above zero and uses it to discharge proofs.
    verification: node tests/run.js bounds && npm run check && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: w5-fact
        content: Add the i >= n fact family to src/bounds.ts with positive and negative cases — see WP31 W5
        status: pending
  - id: w6-merge-instantiations
    title: WP31 W6 — merging instantiations that differ only by range
    goal: Instantiations differing only by range share one body where the code-size gain is measured.
    verification: node tests/run.js generics && node tests/run.js performance && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: w6-merge
        content: Merge range-only instantiations in src/generics.ts and measure code size on a real program — see WP31 W6
        status: pending
  - id: w7-mask-min
    title: WP31 W7 — x & 255 and Math.min(x, 255) as fact sources
    goal: x & 255 and Math.min(x, 255) give bounds.ts range facts, each justified by a measurement.
    verification: node tests/run.js bounds && node tests/run.js performance && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: w7-sources
        content: Add the mask and Math.min fact sources to src/bounds.ts once a measurement asks — see WP31 W7
        status: pending
---

# WP31 — ranged integers

## Context
W1 to W4 landed: `integer<Lo, Hi>`, its range proofs, the host-boundary `RangeError` and the acceptance program (#261 to #274). See [the roadmap page](../../docs/roadmap/wp31-ranged-integers.md). Spec: [design note §11 Open](../../docs/wp31-ranged-integers.md#11-open). Not planned: a constant as a range bound, length floors in types. Stage ids W5 to W7 are this plan's numbering.

## WP31 W5 — a lower-bound fact family, i >= n
A fact `i >= n` for `n > 0`. No program has needed it.

## WP31 W6 — merging instantiations that differ only by range
A code-size question for a real program.

## WP31 W7 — x & 255 and Math.min(x, 255) as fact sources
Sound, and the kind of peephole wp15 §2 refused inside the proof, each to come only when a measurement asks.
