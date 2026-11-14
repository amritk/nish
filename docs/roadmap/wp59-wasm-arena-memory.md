# WP59: The wasm arena in a second, unexported memory

**State:** Proposed · **Done:** 0 of 4 · **Design note:** [`docs/wp59-wasm-arena-memory.md`](https://github.com/amritk/nish/blob/main/docs/wp59-wasm-arena-memory.md)

## Stages

- [ ] S1: a second memory added after `wasm-ld` and exported as `memory`, with the runtime's copy, fill and grow over it, behind a build flag
- [ ] S2: every crossing (array and string arguments and results, host-import strings and windows, panic text, the storage mirror) goes through the exchange area
- [ ] S3: two memories the default for `--profile wasm-host`, the Safari fallback, the rewritten forge test and the perf and size budget *(owner's decisions)*
- [ ] S4: the security record: WH-10's "what stays" closed

## Next

S1, the second memory: [§3](https://github.com/amritk/nish/blob/main/docs/wp59-wasm-arena-memory.md#3-the-decision-this-note-proposes). Before it, check whether a forged trace descriptor reaches outside the arena ([§10](https://github.com/amritk/nish/blob/main/docs/wp59-wasm-arena-memory.md#10-open-questions), question 1).

## Waiting on a decision

How storage crosses (a mirror synced at the edges of a call, a memory bit per array, or a storage type of its own), and how a page that must run in Safari gets a single-memory module ([§8](https://github.com/amritk/nish/blob/main/docs/wp59-wasm-arena-memory.md#8-decisions-for-the-owner)).

## Not planned

Moving the arena out and leaving the program's memory exported, rewriting individual loads and stores after the link, dropping WH-10's bounds, shared memory.

[All work packages](index.md)
