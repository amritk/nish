---
name: WP59 — the wasm arena in a second, unexported memory
overview: A page that holds the module's one memory can still forge a pointer inside the arena. Four stages keep the program's memory unexported as memory 0 and export a second memory for the values that cross, then make it the default and close WH-10's "what stays".
roadmap: docs/roadmap/wp59-wasm-arena-memory.md
spec: docs/wp59-wasm-arena-memory.md
priority: 60
issue: 1861
stages:
  - id: s1-second-memory
    title: WP59 S1 — a second memory added after wasm-ld and exported as memory, behind a build flag
    goal: With NISH_WASM_MEMORIES=2 a wasm-host build has memory 1 exported as memory and the runtime's copy, fill and grow over it, and nothing moves without the flag.
    verification: node tests/run.js wasm-host && node tests/run.js c-symbols && node tests/run.js wasi && npm run lint
    status: pending
    todos:
      - id: s1-check-forge
        content: Check whether a forged trace descriptor reaches outside the arena before building, and record the answer — see WP59 S1 and §10 question 1
        status: pending
      - id: s1-rewrite
        content: Write scripts/wasm-memories.mjs, the post-link rewrite of §3.2, with a fixture test — see WP59 S1
        status: pending
      - id: s1-link
        content: Run the rewrite in the wasm-host link step behind NISH_WASM_MEMORIES=2, with wasm-opt --enable-multimemory after it — see WP59 S1
        status: pending
      - id: s1-runtime
        content: Add nish_page_copy_in, nish_page_copy_out, nish_page_fill, nish_page_grow and nish_memory_bytes in runtime/runtime-wasm.c, compiled with -mmultimemory — see WP59 S1
        status: pending
  - id: s2-crossings
    title: WP59 S2 — every crossing goes through the exchange area
    goal: Array and string arguments and results, host-import strings and windows, panic text and the storage mirror cross through memory 1 and the page cannot read or write memory 0.
    verification: node tests/run.js wasm-host && node tests/run.js wasm-loader && npm run lint
    status: pending
    todos:
      - id: s2-loader
        content: Move the loader's array and string crossings onto the exchange area — see WP59 S2
        status: pending
      - id: s2-imports
        content: Route host-import strings, buffer windows and panic text through the exchange area — see WP59 S2
        status: pending
      - id: s2-storage
        content: Add the module-storage mirror synced at the edges of a call, as the note decides — see WP59 S2
        status: pending
  - id: s3-default
    title: WP59 S3 — two memories the default for the wasm-host profile, the Safari fallback and the budget
    goal: Two memories are the default for --profile wasm-host, a single-memory fallback exists for Safari, the forge test is rewritten and the perf and size budget holds.
    verification: node tests/run.js wasm-host && node tests/run.js performance && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s3-default-build
        content: Make two memories the default in the wasm-host link step and update the guide page — see WP59 S3
        status: pending
      - id: s3-fallback
        content: Add the single-memory fallback for Safari as decided — see WP59 S3
        status: pending
      - id: s3-forge
        content: Rewrite the forge test in tests/ for the two-memory layout and record the perf and size budget — see WP59 S3
        status: pending
  - id: s4-security-record
    title: WP59 S4 — the security record, WH-10's "what stays" closed
    goal: docs/security/wasm-host.md records WH-10's remaining surface as closed with a before and after test.
    verification: node scripts/security-scope.mjs && node docs/check-links.mjs && npm run lint
    status: pending
    todos:
      - id: s4-record
        content: Close WH-10's what-stays in docs/security/wasm-host.md and update its row in docs/security/README.md — see WP59 S4
        status: pending
---

# WP59 — the wasm arena in a second, unexported memory

## Context
Only the design landed, as a docs-only proposal ([roadmap page](../../docs/roadmap/wp59-wasm-arena-memory.md), [design note](../../docs/wp59-wasm-arena-memory.md)); no compiler code has changed. The four stages are the note's [§9](../../docs/wp59-wasm-arena-memory.md#9-stages). LLVM 18 loads and stores only memory 0, so the program's memory stays index 0 and hidden and the page's memory is added after `wasm-ld`.

## WP59 S1 — a second memory added after wasm-ld and exported as memory, behind a build flag
Spec: [§3](../../docs/wp59-wasm-arena-memory.md#3-the-decision-this-note-proposes). Adds `scripts/wasm-memories.mjs`, the link step behind `NISH_WASM_MEMORIES=2` (off by default, objects built with `-O` and linked with none), `nish_memory_bytes()` for tests that read `memory.buffer.byteLength`, and the copy, fill and grow functions over memory 1. Before building, check whether a forged trace descriptor reaches outside the arena ([§10](../../docs/wp59-wasm-arena-memory.md#10-open-questions), question 1).
Likely files: `scripts/wasm-memories.mjs`, `runtime/runtime-wasm.c`, `src/c-symbols.ts`, `tests/run.js`.

## WP59 S2 — every crossing goes through the exchange area
Spec: [§5](../../docs/wp59-wasm-arena-memory.md#5-how-values-cross-and-what-each-copy-costs). Array and string arguments and results, host-import strings and windows, panic text and the storage mirror. The storage design is an owner decision in [§8](../../docs/wp59-wasm-arena-memory.md#8-decisions-for-the-owner); implement the option it picks.
Likely files: `runtime/nish-wasm-loader*`, `runtime/runtime-wasm.c`, `src/`.

## WP59 S3 — two memories the default for the wasm-host profile, the Safari fallback and the budget
Spec: [§6](../../docs/wp59-wasm-arena-memory.md#6-engines-and-the-fallback) and [§8](../../docs/wp59-wasm-arena-memory.md#8-decisions-for-the-owner). The roadmap marks this stage as the owner's decisions.

### Decision needed
How storage crosses (a mirror synced at the edges of a call, a memory bit per array, or a storage type of its own), how a page that must run in Safari gets a single-memory module, and how large the exchange area is under `--memory`. The options and trade-offs are in §8; the note holds no single recommendation beyond the mirror it builds in S1 and S2.

## WP59 S4 — the security record, WH-10's "what stays" closed
Spec: [§9](../../docs/wp59-wasm-arena-memory.md#9-stages). Closes the "what stays" residue in `docs/security/wasm-host.md`, with the rewritten forge test as its before and after.
Likely files: `docs/security/wasm-host.md`, `docs/security/README.md`.
