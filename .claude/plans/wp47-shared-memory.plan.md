---
name: WP47 — shared work across cores, regions, atomics and rings
overview: Sleeping and waking a ring on Darwin is deferred, and the atomic-arrays acceptance (issue 1606) left three gaps in refusals, the nish-cmp header declarations and the emit-ts route.
roadmap: docs/roadmap/wp47-shared-memory.md
spec: docs/wp47-shared-memory.md
priority: 80
stages:
  - id: s2-darwin-wake
    title: WP47 S2 — sleeping and waking a ring on Darwin
    goal: A ring on Darwin sleeps and wakes instead of polling, through a supported wait-on-address call, and SHM_UNSUPPORTED is no longer answered there.
    verification: node tests/run.js sync && node scripts/security-scope.mjs && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: s2-api
        content: Use os_sync_wait_on_address once the oldest supported SDK has it, in the runtime's futex wait and wake — see WP47 S2
        status: pending
      - id: s2-record
        content: Update the shared-memory security record and docs/wp47-shared-memory.md §4 for the Darwin wake — see WP47 S2
        status: pending
  - id: s3-atomic-array-acceptance
    title: WP47 S3 — atomic arrays, refusals for every route, the header declarations and the emit-ts route
    goal: Every refusal route that rejects an AtomicI32 has an array case naming the array type, the nish-cmp decision on std class declarations is recorded, and the emit-ts output for the array classes has a fixture.
    verification: node tests/run.js reject && node tests/nish-cmp.js && npm run lint
    status: pending
    issue: 1606
    labels: [needs-decision]
    todos:
      - id: s3-reject
        content: Add reject_atomic_array_* cases for par_result, member_nested, the region_* and sibling_* routes in tests/cases — see WP47 S3
        status: pending
      - id: s3-wording
        content: Make the diagnostics in src/parallel.ts name AtomicI32Array or AtomicI64Array and regenerate the .err files — see WP47 S3
        status: pending
      - id: s3-header
        content: Decide whether std/threads.ts classes appear in a program's header only when reached, and add or skip DECLARED entries in tests/nish-cmp.js — see WP47 S3
        status: pending
      - id: s3-emit-ts
        content: Add an --emit-ts fixture that runs the AtomicI32Array and AtomicI64Array output — see WP47 S3
        status: pending
---

# WP47 — shared work across cores, regions, atomics and rings

## Context
`nish/sync/shm` and `nish/sync/ring`, the example, the benchmarks and the security record have landed ([roadmap page](../../docs/roadmap/wp47-shared-memory.md)). One box is deferred. Issue #1606 is about the atomic arrays added to `nish/threads` (#1598) and fits this plan only loosely, since its work is in the threads checker and `std/threads.ts` rather than `nish/sync`.

## WP47 S2 — sleeping and waking a ring on Darwin
Spec: [§4](../../docs/wp47-shared-memory.md#4-waking-another-process) and [§10](../../docs/wp47-shared-memory.md#10-not-done). Darwin answers `SHM_UNSUPPORTED` (-95) from the sleep and the wake, because its public wait-on-address call is not in the oldest SDK the build supports and `__ulock_wait` is private; rings poll there. Reopen when `os_sync_wait_on_address` is available in that SDK.
Likely files: `runtime/`, `std/sync/ring.ts`, `docs/security/`.

## WP47 S3 — atomic arrays, refusals for every route, the header declarations and the emit-ts route
Issue #1606 is this stage; its three gaps in one PR's worth of tests.
- Criterion 4: only 8 `tests/cases/reject_atomic_array_*` cases exist against about 35 for `AtomicI32`; none cover `par_result`, `member_nested`, 14 of 15 `region_*` routes or 10 of 11 `sibling_*` routes, and most messages say "an atomic" rather than naming the array type.
- Criterion 7: adding the classes to `std/threads.ts` changes `threads.ll` and adds `struct AtomicI32Array;` to the header of about 126 corpus programs, declared in `tests/nish-cmp.js`.
- Criterion 1: no test runs `nish --emit-ts` output for the new classes.
Likely files: `src/parallel.ts`, `tests/cases/`, `tests/nish-cmp.js`, `tests/run.js`.

### Decision needed
Is the header and `threads.ll` change for programs that never use the arrays a defect? Option A accept it as inherent to growing a std module (DECLARED entries stay); option B emit an imported module's classes and header declarations only when reached (no entries, but a compiler change). The issue leaves the call to the owner.
