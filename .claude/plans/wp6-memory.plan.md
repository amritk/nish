---
name: WP6 — memory, escape-analysed stack, arena scopes, T | null
overview: Two deferred refinements remain, a stack rule for branch-assigned locals and objects stored into a local container, and precise lifetime markers on hoisted allocas. Neither is scheduled; the design note says what would reopen each.
roadmap: docs/roadmap/wp6-memory.md
spec: docs/wp6-memory.md
priority: 80
labels: [deferred]
stages:
  - id: s2-branch-assigned-stack
    title: WP6 S2 — a stack rule for branch-assigned locals and objects stored into a local container
    goal: A local assigned in each arm of a branch, and an object stored into a local container, can live on the stack when escape analysis proves them confined, with no silent loss of the function's scope.
    verification: node tests/run.js escape && node tests/run.js performance && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: s2-fact
        content: Add a captured-only-into-one-binding fact (allocEscapes already approximates it) in src/escape.ts — see WP6 S2
        status: pending
      - id: s2-tests
        content: Add escape cases for a branch-assigned let and an object pushed into a local array, with golden IR and a negative that still escapes — see WP6 S2
        status: pending
  - id: s3-lifetime-markers
    title: WP6 S3 — precise llvm.lifetime.start and end on hoisted allocas
    goal: Hoisted allocas carry lifetime.start and lifetime.end at the scope exits the emitter tracks, with no IR change for programs it cannot prove.
    verification: node tests/run.js performance && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: s3-exits
        content: Track scope exits in the emitter so a precise end can be placed on each hoisted alloca — see WP6 S3
        status: pending
      - id: s3-measure
        content: Measure stack size and time on the corpus with the markers and record the figures — see WP6 S3
        status: pending
---

# WP6 — memory, escape-analysed stack, arena scopes, T | null

## Context
The arenas, escape-analysed stack allocation, call-site, callee and loop-pass scopes, and `using a = arena()` have landed ([roadmap page](../../docs/roadmap/wp6-memory.md)). Both open boxes are deferred; the note's [Left out](../../docs/wp6-memory.md#left-out) section says what would reopen them.

## WP6 S2 — a stack rule for branch-assigned locals and objects stored into a local container
A `let` assigned in each arm of a branch sets `allocLeaks`, so the function loses its scope silently unless §2c's rule rescues it; an object stored into a local container never moves to the stack, and a constructor storing a parameter into `this` makes the argument a leak. The note names a "captured only into one binding" fact, which `allocEscapes` already approximates, as the way to close both. `--emit-arena` is the audit that exists today.
Likely files: `src/escape.ts`, `docs/wp6-memory.md`, `docs/LANGUAGE.md`.

## WP6 S3 — precise llvm.lifetime.start and end on hoisted allocas
Precise `end`s need scope exits that the emitter does not track, so the allocas are hoisted without them. Reopen only if stack growth in a long function is measured as a problem.
Likely files: `src/emit-*.ts`, `docs/wp6-memory.md`.
