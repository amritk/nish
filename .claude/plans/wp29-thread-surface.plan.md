---
name: WP29 — the thread surface, the deferred stages
overview: parallelMap, scope, Mutex, Channel and atomics have landed. Three additions stay deferred — parallelSort, parallelFilter and copy-at-join for class values — and the design note says what would reopen each.
spec: docs/wp29-thread-surface.md
priority: 80
labels: [deferred]
issue: 1988
stages:
  - id: s6-parallel-sort
    title: WP29 S6 — parallelSort
    goal: std/threads.ts exports parallelSort, equal in result to the serial sort and to Node, with a measured speedup recorded.
    verification: node tests/run.js thread && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    labels: [deferred]
    issue: 1990
    todos:
      - id: s6-surface
        content: Declare parallelSort in std/threads.ts with its doc comment and the legality rules of parallelMap — see WP29 S6 — parallelSort
        status: pending
      - id: s6-case
        content: Add a tests/cases parallelSort program with a golden .ll and a result identical to the serial sort, plus a refusal negative — see WP29 S6 — parallelSort
        status: pending
      - id: s6-docs
        content: Add the LANGUAGE.md rule, cookbook entry, docs/guide/using-nish/threads.md section and regenerate docs/reference — see WP29 S6 — parallelSort
        status: pending
  - id: s7-parallel-filter
    title: WP29 S7 — parallelFilter
    goal: std/threads.ts exports parallelFilter that keeps element order and gives the same result as the serial filter and Node.
    verification: node tests/run.js thread && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    labels: [deferred]
    issue: 1991
    todos:
      - id: s7-surface
        content: Declare parallelFilter in std/threads.ts, concatenating per-block results in order — see WP29 S7 — parallelFilter
        status: pending
      - id: s7-case
        content: Add a tests/cases parallelFilter program with golden .ll, llvm-as, native round trip and a negative — see WP29 S7 — parallelFilter
        status: pending
      - id: s7-docs
        content: Add the LANGUAGE.md rule, cookbook entry and guide section, and regenerate docs/reference — see WP29 S7 — parallelFilter
        status: pending
  - id: s8-class-copy
    title: WP29 S8 — copy-at-join for class values
    goal: A class value crosses the join by copy, with the refusal that stands today (C1) narrowed to what remains uncopyable and each remaining refusal still tested.
    verification: node tests/run.js thread && node tests/run.js link && npm run lint
    status: pending
    labels: [deferred]
    issue: 1992
    todos:
      - id: s8-rule
        content: Extend the copy-at-join rule of section 7 to class values and state what a class holding an array or another class does — see WP29 S8 — copy-at-join for class values
        status: pending
      - id: s8-checker
        content: Relax the class refusal in the thread legality walk in src/ for the copyable cases only, each with a positive and a negative test — see WP29 S8 — copy-at-join for class values
        status: pending
---

# WP29 — the thread surface, the deferred stages

## Context
Landed: P1 (`parallelMapInto`, `parallelReduce`, `parallelMap`, `parallelFrom`), P2 (`scope()`), P3 (`Mutex`, `Channel`, atomics), strings and scalar arrays copied across the join, and `nish --fix` for six refusals — see [the design note](../../docs/wp29-thread-surface.md) (5 of 8 done). Design note: [docs/wp29-thread-surface.md](../../docs/wp29-thread-surface.md); user guide `docs/guide/using-nish/threads.md`. The roadmap says unchecked items are deferred and the note says what would reopen each. No GitHub issue is assigned to this plan.

## WP29 S6 — parallelSort
Deferred, not declined (note, intro). The partitioner's open question (runtime or emitted IR) in section 11 bears on it. Likely files: `std/threads.ts`, `runtime/` partitioner, `docs/LANGUAGE.md`.

## WP29 S7 — parallelFilter
Deferred, not declined. The output length is data-dependent, so per-block results must be concatenated in order, the same on one thread and under Node (as `parallelReduce` does). Likely files: `std/threads.ts`.

## WP29 S8 — copy-at-join for class values
Section 7 widened the join to strings and scalar arrays; arrays of objects and class values stay refused (C1). The lead should read section 7 for what a copy of a class holding an array means before cutting this to size. Likely files: the thread walk in `src/`, `docs/LANGUAGE.md`.
