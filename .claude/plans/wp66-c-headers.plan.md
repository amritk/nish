---
name: WP66 — C libraries from their headers, callbacks
overview: nish c-import, opaque classes, array fields, named buffer pairs and package-linked C all landed. What is left is S6, C callbacks, which waits on an open question about what C may do with a callback.
roadmap: docs/roadmap/wp66-c-headers.md
spec: docs/wp66-c-headers.md
priority: 80
stages:
  - id: s6-callbacks
    title: WP66 S6 — C callbacks, a top-level function passed as a C function pointer
    goal: A top-level function named at a call of a declare function is passed as a C-ABI function pointer, with the rules for threads, late calls and panics decided and each enforced by a test.
    verification: node tests/run.js ffi && node tests/run.js c-import && node tests/run.js link && node tests/run.js wasi && npm run check && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s6-decide
        content: Record the owner's answers to what C may do with a callback in section 8 S6 and decisions D1 to D7 in section 9 of docs/wp66-c-headers.md — see WP66 S6 — C callbacks
        status: pending
      - id: s6-check
        content: Accept a top-level function named at the call as a function-pointer argument in the src/ checker and refuse a reference held in a variable — see WP66 S6 — C callbacks
        status: pending
      - id: s6-lower
        content: Lower the argument to the address of a C-ABI entry like the one --emit-header writes, analysing the function as an export in src/ — see WP66 S6 — C callbacks
        status: pending
      - id: s6-tests
        content: Add a tests/cases callback program with golden .ll, llvm-as, native round trip, and negatives for each thing the decision forbids — see WP66 S6 — C callbacks
        status: pending
      - id: s6-docs
        content: Update docs/LANGUAGE.md, the cookbook, docs/guide/using-nish/c-import.md and docs/security/c-import.md for callbacks — see WP66 S6 — C callbacks
        status: pending
---

# WP66 — C libraries from their headers, callbacks

## Context
Landed: S1 (`zeroext`), S2 (`nish c-import`), S3 (opaque classes), S4 (array fields), S5 (buffer pairs), S7 (a package links C) and S8 (c-import writes opaque classes, array fields and buffer pairs) — see [the roadmap page](../../docs/roadmap/wp66-c-headers.md) (7 of 8 done). Design note: [docs/wp66-c-headers.md](../../docs/wp66-c-headers.md). No GitHub issue is assigned to this plan.

## WP66 S6 — C callbacks, a top-level function passed as a C function pointer
Spec: [section 8, S6](../../docs/wp66-c-headers.md#s6-callbacks-open-question). 46 of `sqlite3.h`'s functions and 15 of `png.h`'s take a function pointer. A WP51 function reference is an `i32` tag that WP51 refuses to let cross the C ABI, so a callback is a separate construct: a top-level function named at the call (as a `spawn` task is), lowered to the address of a C-ABI entry, analysed like an export (C may call it from anywhere). A `void *` user-data argument stays a `CPtr`; `SQLITE_TRANSIENT` is the same question in miniature.
Likely files: `src/` checker and emit, `runtime/nish.d.ts`, `docs/security/c-import.md`.

### Decision needed
What may C do with a callback: call it on another thread, after the registering call has returned, or with a panic unwinding through C frames. Each answer decides what the arena, `--threads` and `--deny-panics` must do around it. The note's section 9 lists the owner's other decisions D1 to D7 (D5 the spelling of opaque types, D6 what linking may run, D7 whether `std/sqlite.ts` is regenerated); the note recommends in D2 and D3 and the lead should read it before asking. The note gives no recommendation for the callback question itself.
