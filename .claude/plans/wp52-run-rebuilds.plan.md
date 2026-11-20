---
name: WP52 — fast rebuilds for nish run
overview: The per-module object cache is in. The remaining cost of a rebuild is the front end, about 0.8 s of 1.0 to 1.4 s, which a cache of the checked form between runs would remove; it is deferred.
roadmap: docs/roadmap/wp52-run-rebuilds.md
spec: docs/wp52-run-rebuilds.md
priority: 80
labels: [deferred]
stages:
  - id: s2-checked-front-end-cache
    title: WP52 S2 — caching the checked front end between runs
    goal: nish run keeps each module's checked form between runs so a one-line edit skips the front end, with the median rebuild below the current 1.45 s.
    verification: node tests/run.js cli && node tests/run.js performance && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: s2-design
        content: Define the checked form's serialization and cache key across the checker's inputs and outputs in src/ — see WP52 S2
        status: pending
      - id: s2-cache
        content: Store and load the checked form in src/run-cache.ts and invalidate it on any input change — see WP52 S2
        status: pending
      - id: s2-measure
        content: Re-time the one-line-edit rebuild and record it in docs/wp52-run-rebuilds.md — see WP52 S2
        status: pending
---

# WP52 — fast rebuilds for nish run

## Context
The per-module object cache landed: a one-line edit rebuilds in a median 1.45 s ([roadmap page](../../docs/roadmap/wp52-run-rebuilds.md)). The remaining box is deferred.

## WP52 S2 — caching the checked front end between runs
Spec: [§5 What is left](../../docs/wp52-run-rebuilds.md#5-what-is-left). Most of a rebuild is the front end, about 0.8 s of the program's 1.0 to 1.4 s, which runs on every `nish run`, hit or miss. Caching it keeps each module's checked form between runs, a change to the checker's inputs and outputs rather than to the run driver. Two smaller costs stay and are not this stage's target: the second `clang --version` (about 30 ms) and the `sqlite3.c` fingerprint (about 70 ms). The module cache is never pruned, so a new cache needs a size answer too.
Likely files: `src/run-cache.ts`, `src/compile.ts`, `src/check*.ts`.
