# WP29: The thread surface

**State:** Landed · **Open work:** [#1988](https://github.com/amritk/nish/issues/1988) · **Design note:** [`docs/wp29-thread-surface.md`](https://github.com/amritk/nish/blob/main/docs/wp29-thread-surface.md)

## Stages

- [x] P1: `parallelMapInto`, `parallelReduce`, `parallelMap` and `parallelFrom` in `std/threads.ts`
- [x] P2: `using s = scope()` for different tasks side by side
- [x] P3: `Mutex<T>`, `Channel<T>`, and `AtomicI32`/`AtomicI64` ([#654](https://github.com/amritk/nish/pull/654))
- [x] Strings and scalar arrays copied across the join ([#669](https://github.com/amritk/nish/pull/669))
- [x] `nish --fix` repairs six thread refusals ([#691](https://github.com/amritk/nish/pull/691))

## Open work

Open stages are the sub-issues of [#1988](https://github.com/amritk/nish/issues/1988), one pull request each, specified in [`.claude/plans/wp29-thread-surface.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp29-thread-surface.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

Detached spawn and `Arc<T>`, `select`, bounded channels, a configurable pool or `scope(n)`, wasm threads, work stealing.

[All work packages](index.md)
