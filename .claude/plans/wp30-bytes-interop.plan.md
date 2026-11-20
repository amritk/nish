---
name: WP30 — bytes across the interop boundary
overview: Typed arrays already cross wasm and N-API. Two deferred refinements remain, a caller-owned destination for array results and a cheaper nish_alloc_array from JavaScript.
roadmap: docs/roadmap/wp30-bytes-interop.md
spec: docs/wp30-bytes-interop.md
priority: 80
labels: [deferred]
stages:
  - id: s2-caller-owned-result
    title: WP30 S2 — a caller-owned destination for an array result
    goal: A generated loader signature can write an array result into a caller-owned buffer instead of arrayOut's slice copy, which at 25 MB costs 44.8 ms against 1.8 ms.
    verification: node tests/run.js wasm-host && node tests/run.js napi && npm run lint
    status: pending
    labels: [deferred]
    todos:
      - id: s2-signature
        content: Design the changed generated signature for array-returning calls and add it to the loader — see WP30 S2
        status: pending
      - id: s2-bench
        content: Measure arrayOut against the caller-owned form at 25 MB and record it — see WP30 S2
        status: pending
  - id: s3-cheaper-alloc-array
    title: WP30 S3 — a cheaper nish_alloc_array from JavaScript
    goal: Allocating an array from JavaScript no longer costs a BigInt per call, by batching in the generator or a u32 companion export.
    verification: node tests/run.js wasm-host && node tests/run.js napi && npm run lint
    status: pending
    labels: [deferred, needs-decision]
    todos:
      - id: s3-choose
        content: Choose between batching in the generator and a u32 companion to nish_alloc_array in runtime/ — see WP30 S3
        status: pending
      - id: s3-measure
        content: Measure 31 ns against 23 ns per allocation and the batched form (web/bytes-worker.mjs, 947 ns to 512 ns per document) after the change — see WP30 S3
        status: pending
---

# WP30 — bytes across the interop boundary

## Context
`u8[]`, `u16[]`, `u32[]` and `u64[]` cross wasm and N-API as typed arrays and have landed ([roadmap page](../../docs/roadmap/wp30-bytes-interop.md)). Both open boxes are deferred findings from [Deferred: two findings next door](../../docs/wp30-bytes-interop.md#deferred-two-findings-next-door).

## WP30 S2 — a caller-owned destination for an array result
The loader ends an array-returning call with `new Ctor(memory.buffer, data, len).slice()`. At 25 MB that is 44.8 ms against 1.8 ms for `.set()` into a caller-owned buffer, 25x, the allocation rather than the copy. `.slice()` stays the default, since the next `memory.grow` detaches a view and the arena release lets the module overwrite it. A caller-owned destination changes a generated signature, so it is its own package.
Likely files: `runtime/` loader, `src/interop-*.ts`, `docs/guide/`.

## WP30 S3 — a cheaper nish_alloc_array from JavaScript
`nish_alloc_array` costs a `BigInt` per call because both parameters are `u64`: 31 ns against 23 ns for the allocation. A host can allocate once per batch and rewrite the header's `len` as two `i32` stores, as `web/bytes-worker.mjs` does.
Likely files: `runtime/`, `src/interop-*.ts`.

### Decision needed
Should the generator batch, or should the runtime export a `u32` companion? Batching needs no runtime change but every host rewrites the header; a companion is simpler for hosts but adds an export to every module. The note leaves it open.
