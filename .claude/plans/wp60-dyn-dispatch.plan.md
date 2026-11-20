---
name: WP60 — dynamic dispatch over interfaces
overview: Dyn<I> (a tag and a pointer, calls lowered to a per-place switch of direct calls) is designed and measured but unbuilt. Stage 1 can ship now with no IR moved; stages 2 and 3 are each gated on their own build's timing.
roadmap: docs/roadmap/wp60-dyn-dispatch.md
spec: docs/wp60-dyn-dispatch.md
priority: 60
issue: 1872
stages:
  - id: s1-signatures
    title: WP60 S1 — interface method signatures and T extends I, with no IR moved
    goal: An interface may declare method signatures, implements checks them (NL2778), T extends I calls them, and a method call on a plain I is NL2774, with no IR change.
    verification: node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    status: pending
    issue: 1883
    todos:
      - id: s1-collector
        content: Record interface method signatures in a list on StructInfo in src/structs.ts and admit them in refuseMembers in src/statements.ts — see WP60 S1 — interface method signatures and T extends I, with no IR moved
        status: pending
      - id: s1-implements
        content: Check implements against signatures (NL2778), refuse a method-bearing interface as an argument (NL2780) and add the NL2774 branch in src/members.ts and src/generics.ts — see WP60 S1 — interface method signatures and T extends I, with no IR moved
        status: pending
      - id: s1-docs
        content: Add the tests, LANGUAGE.md rule, cookbook entry, guide page and --emit-ts reading — see WP60 S1 — interface method signatures and T extends I, with no IR moved
        status: pending
  - id: s2-dyn-locals
    title: WP60 S2 — Dyn of an interface in locals, parameters, returns and calls
    goal: Dyn<I> works in locals, parameters, returns and calls with per-place sets, the escape-join refusal and the debug tag check, and a stored Dyn<I> is refused (NL2779).
    verification: node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    status: pending
    todos:
      - id: s2-gate
        content: Build the stage and measure it against the note's stage 2 gate before landing — see WP60 S2 — Dyn of an interface in locals, parameters, returns and calls
        status: pending
      - id: s2-lowering
        content: Lower a Dyn call to a per-place switch of direct calls with the escape-join refusal in src/ — see WP60 S2 — Dyn of an interface in locals, parameters, returns and calls
        status: pending
      - id: s2-docs
        content: Add golden .ll, round trip, negatives (NL2779), LANGUAGE.md rule, cookbook and guide page — see WP60 S2 — Dyn of an interface in locals, parameters, returns and calls
        status: pending
  - id: s3-dyn-stored
    title: WP60 S3 — Dyn of an interface in fields, arrays, Map values, null unions and Result arms
    goal: Dyn<I> may be stored (fields, arrays, Map values, | null, Result arms and threads) as one tagged word, replacing the NL2779 refusal.
    verification: node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint
    status: pending
    todos:
      - id: s3-gate
        content: Build the stage after S2 and measure it against the note's stage 3 gate before landing — see WP60 S3 — Dyn of an interface in fields, arrays, Map values, null unions and Result arms
        status: pending
      - id: s3-places
        content: Extend the per-place pass to the stored places and drop NL2779 in src/ — see WP60 S3 — Dyn of an interface in fields, arrays, Map values, null unions and Result arms
        status: pending
  - id: s4-idiom
    title: WP60 S4 — the agents' idiom and the NL2079 decision
    goal: docs/AI.md and the guide teach Dyn as the way to dispatch, and NL2079's wording is decided.
    verification: npm run lint && node docs/check-links.mjs
    status: pending
    todos:
      - id: s4-ai-md
        content: Add the Dyn idiom to docs/AI.md and the guide and decide NL2079's wording — see WP60 S4 — the agents' idiom and the NL2079 decision
        status: pending
---

# WP60 — dynamic dispatch over interfaces

## Context
Only the design and measurement have landed (a `Dyn<I>` of a tag and a pointer, calls lowered to a per-place `switch` of direct calls, against the hand-written dispatch); see [the roadmap page](../../docs/roadmap/wp60-dyn-dispatch.md). The note recommends shipping stage 1 now, with stages 2 and 3 each gated on its own build's timing (neither passes on the note's figures yet). Every stage changes `src/`: run `node tests/self/goldens.js --update`, `node tests/differential/goldens.js --update` for new positive cases, and `wasi` and `performance` before pushing. Spec: [design note §9](../../docs/wp60-dyn-dispatch.md#9-stages).

## WP60 S1 — interface method signatures and T extends I, with no IR moved
An interface may declare method signatures; `implements` checks them (NL2778); `<T extends I>` calls them on `T`; a method call on a plain `I` is NL2774. Signatures live in their own list on the interface's `StructInfo`, never in `methodSigs`, so nothing emits them. Duplicate member checks must cover the new list. The note lists the exact sites (`refuseMembers`, the interface collector, `checkImplements`, `satisfiesConstraint`, NL2556's check).
Likely files: `src/statements.ts`, `src/structs.ts`, `src/members.ts`, `src/generics.ts`, `src/parser.ts` comments.

## WP60 S2 — Dyn of an interface in locals, parameters, returns and calls
`Dyn<I>` in locals, parameters, returns and calls; per-place sets; the escape-join refusal; the debug tag check; a stored `Dyn<I>` refused (NL2779) until S3. Gated on the note's stage 2 gate: the build's own timing against hand-written dispatch decides whether it lands. Depends on S1.

## WP60 S3 — Dyn of an interface in fields, arrays, Map values, null unions and Result arms
`Dyn<I>` as fields, arrays, `Map` values, `| null`, `Result` arms and threads, as one tagged word. Gated on the stage 3 gate, after S2.

## WP60 S4 — the agents' idiom and the NL2079 decision
The agents' idiom for `Dyn` and the decision on NL2079; `std/` adoption is later work. `src/` itself can use `Dyn` one release after it ships ([§5.4](../../docs/wp60-dyn-dispatch.md#54-the-rolling-freeze)).
