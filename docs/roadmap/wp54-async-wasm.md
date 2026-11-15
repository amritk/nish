# WP54: `async` on wasm, with the page as the executor

**State:** Proposed · **Done:** 0 of 4 · **Design note:** [`docs/wp54-async-wasm.md`](https://github.com/amritk/nish/blob/main/docs/wp54-async-wasm.md)

## Stages

- [ ] Stage 1: where JSPI runs, and one `async` export over one `async` host import lowered by hand on `wasm32`, run in Node and Chromium
- [ ] Stage 2: the executor's queue on wasm, `nish_async_complete`, `async` exports and host imports in the loader and the `.d.ts`, NL2652 narrowed, `sleep` through the loader
- [ ] Stage 3: a task's memory on wasm, from a fixed pool or a `malloc` under `wasm-host`, with its security record
- [ ] Stage 4: a Worker-shaped example, under Node and the Worker runtime, its cost per request measured against the same handler in TypeScript

## Next

Waiting on the owner: Q1, whether to build it at all, which waits on a program that must run on a Worker. Spec: [§7 Questions for the owner](https://github.com/amritk/nish/blob/main/docs/wp54-async-wasm.md#7-questions-for-the-owner).

## Waiting on a decision

Q1, whether to build it, which is worth building only for a program that must run on Cloudflare Workers; Q2, a task's memory on wasm (a fixed pool, a `malloc`, or both by a flag); Q3, JSPI instead; Q4, which waits exist on wasm; Q5, whether the loader writes a Worker's entry. Spec: [§7](https://github.com/amritk/nish/blob/main/docs/wp54-async-wasm.md#7-questions-for-the-owner).

## Not planned

Promises as values, threads on wasm, generated bindings for a Worker's platform, an executor that waits without a host loop.

[All work packages](index.md)
