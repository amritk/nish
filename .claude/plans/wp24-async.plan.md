---
name: WP24 — async/await, the deferred N-API Async surface
overview: WP24 is superseded by WP49, which built async/await. One deferred box remains, strings, arrays and a by-value Result through the N-API shim's name-Async exports.
roadmap: docs/roadmap/wp24-async.md
spec: docs/wp24-async.md
priority: 80
labels: [deferred]
issue: 1918
stages:
  - id: napi-async-values
    title: WP24 S4 — strings, arrays and a by-value Result through the N-API Async exports
    goal: A --emit-napi-async export taking or returning a string, an array or a by-value Result works through name-Async by a malloc-ed copy, with its security record.
    verification: node tests/run.js napi && node scripts/security-scope.mjs && npm run lint
    status: pending
    labels: [deferred]
    issue: 1959
    todos:
      - id: napi-async-copy
        content: Pass strings and arrays across the name-Async shim through a malloc-ed copy in the --emit-napi-async emitter — see WP24 S4 strings arrays Result
        status: pending
      - id: napi-async-result
        content: Return a by-value Result through name-Async and reject on the error arm — see WP24 S4 strings arrays Result
        status: pending
---

# WP24 — async/await, the deferred N-API Async surface

## Context
`--emit-napi-async`, `async`/`await` (by WP49) and `await sleep(ms)` have landed; see [the roadmap page](../../docs/roadmap/wp24-async.md). The package is superseded, and this last box is deferred.

## WP24 S4 — strings, arrays and a by-value Result through the N-API Async exports
Spec: [design note §5](../../docs/wp24-async.md#5-what-to-build-instead), which lists strings and arrays across `<name>Async` through a `malloc`ed copy as not built. Deferred: the note's section 8 says what would reopen it ("the trigger is I/O, not syntax"). Nothing to do until a program needs it.
Likely files: `src/` N-API emitter for `--emit-napi-async`, `docs/security/`.
