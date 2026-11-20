---
name: WP54 — async on wasm, with the page as the executor
overview: Proposed and unbuilt, with all four stages open. It is worth building only for a program that must run on Cloudflare Workers, which the owner has not confirmed (Q1).
roadmap: docs/roadmap/wp54-async-wasm.md
spec: docs/wp54-async-wasm.md
priority: 60
labels: [needs-decision]
issue: 1956
stages:
  - id: s1-spike
    title: WP54 S1 — where JSPI runs, and one async export over one async host import lowered by hand on wasm32
    goal: A survey of where JSPI runs and a hand-lowered async export over an async host import run in Node and Chromium, with the executor's queue split from its epoll half.
    verification: node tests/run.js wasm && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s1-jspi-survey
        content: Survey where JSPI runs in Node, Chromium and the Worker runtime and record it as Q3's evidence in docs/wp54-async-wasm.md — see WP54 S1 spike
        status: pending
      - id: s1-hand-lowering
        content: Lower one async export over one async host import by hand on wasm32 with runtime/runtime-async.c's queue split from its epoll half, and run it in Node and Chromium — see WP54 S1 spike
        status: pending
  - id: s2-executor-wasm
    title: WP54 S2 — the executor's queue on wasm, nish_async_complete and async exports and host imports in the loader
    goal: async exports and async host imports work through the loader and the .d.ts, NL2652 is narrowed to what stays refused, and sleep works through the loader.
    verification: node tests/run.js wasm && node tests/run.js async && node scripts/gen-reference.mjs --check && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s2-queue-complete
        content: Build runtime-async.c's queue and tokens without the poll half and add nish_async_complete for wasm — see WP54 S2 executor on wasm
        status: pending
      - id: s2-loader-dts
        content: Support async exports and async host imports in the loader and the generated .d.ts — see WP54 S2 executor on wasm
        status: pending
      - id: s2-narrow-nl2652
        content: Narrow NL2652 in src/ to what stays refused, with its tests/link negative, and add sleep through a loader import — see WP54 S2 executor on wasm
        status: pending
  - id: s3-task-memory
    title: WP54 S3 — a task's memory on wasm, from a fixed pool or a malloc under wasm-host
    goal: A task on wasm gets its region by Q2's answer, with its docs/security record.
    verification: node tests/run.js wasm && node scripts/security-scope.mjs && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s3-memory
        content: Give each task a region from a fixed pool or a malloc under wasm-host as the owner decides, in runtime/runtime-async.c — see WP54 S3 task memory Decision needed
        status: pending
      - id: s3-record
        content: Write the docs/security record and index row for the wasm task memory — see WP54 S3 task memory
        status: pending
  - id: s4-worker-example
    title: WP54 S4 — a Worker-shaped example under Node and the Worker runtime, its cost per request measured
    goal: An example module answering requests over an awaited host fetch and database handle runs under Node and the Worker runtime in CI, with its cost per request measured against the same handler in TypeScript.
    verification: node tests/run.js examples && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: s4-example
        content: Add an example under examples/ answering requests over an awaited host fetch and database handle, run under Node and the Worker runtime in CI — see WP54 S4 Worker example
        status: pending
      - id: s4-measure
        content: Measure its cost per request against the same handler written in TypeScript and record it in docs/BENCHMARKS.md — see WP54 S4 Worker example
        status: pending
---

# WP54 — async on wasm, with the page as the executor

## Context
Nothing has landed: all 4 stages are open and the package is Proposed; see [the roadmap page](../../docs/roadmap/wp54-async-wasm.md). The whole package waits on Q1 and its four siblings in [the design note §7](../../docs/wp54-async-wasm.md#7-questions-for-the-owner), so every stage is labelled needs-decision. Stages follow [§8](../../docs/wp54-async-wasm.md#8-stages-if-it-is-built).

## WP54 S1 — where JSPI runs, and one async export over one async host import lowered by hand on wasm32
Size S. A survey (Q3's evidence) and a spike: lower one `async` export over one `async` import by hand, with the executor's queue split from its `epoll` half, and run it in Node and Chromium.

### Decision needed
Q1: build this at all. The note recommends only when a program that must run on a Worker asks for it, since a page does not need it (§1) and a native service has WP49; until then keep NL2652. Options: build, or keep awaiting and calling exports (WP50 section 6).

## WP54 S2 — the executor's queue on wasm, nish_async_complete and async exports and host imports in the loader
Size M. `runtime-async.c`'s queue and tokens without the poll half; `nish_async_complete`; async exports and imports in the loader and `.d.ts`; NL2652 narrowed; `sleep` through the loader (Q4 recommends `sleep` through a loader import, `readable` and `writable` stay refused).

### Decision needed
Q4 (which waits exist on wasm) and Q5 (whether the loader generates a Worker's `fetch` entry). Recommended: `sleep` only, and no generated entry, the Worker's module stays ordinary TypeScript calling an export.

## WP54 S3 — a task's memory on wasm, from a fixed pool or a malloc under wasm-host
Size M, with its security record. Spec: [§4](../../docs/wp54-async-wasm.md#4-memory-the-region-each-task-is-given).

### Decision needed
Q2: a task's memory on wasm. Options: regions from a fixed pool, a `malloc` under `wasm-host`, or both by a flag. Recommended: both by a flag, the pool for a page so views never go stale, `malloc` for a Worker which holds no views.

## WP54 S4 — a Worker-shaped example under Node and the Worker runtime, its cost per request measured
Size M. Spec: [§5](../../docs/wp54-async-wasm.md#5-a-worker). A module answering requests over an awaited host `fetch` and an awaited database handle, run under Node and the Worker runtime in CI, with its cost per request measured against the same handler in TypeScript. It exists only if Q1 is yes.
