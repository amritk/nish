# WP29: The thread surface

**State:** Landed · **Done:** 5 of 8 · **Design note:** [`docs/wp29-thread-surface.md`](https://github.com/amritk/nish/blob/main/docs/wp29-thread-surface.md)

## Stages

- [x] P1: `parallelMapInto`, `parallelReduce`, `parallelMap` and `parallelFrom` in `std/threads.ts`
- [x] P2: `using s = scope()` for different tasks side by side
- [x] P3: `Mutex<T>`, `Channel<T>`, and `AtomicI32`/`AtomicI64` ([#654](https://github.com/amritk/nish/pull/654))
- [x] Strings and scalar arrays copied across the join ([#669](https://github.com/amritk/nish/pull/669))
- [x] `nish --fix` repairs six thread refusals ([#691](https://github.com/amritk/nish/pull/691))
- [ ] `parallelSort` *(deferred)*
- [ ] `parallelFilter` *(deferred)*
- [ ] Copy-at-join for class values *(deferred)*

## Next

Nothing scheduled. Any unchecked item is deferred; the note says what would reopen it.

## Not planned

Detached spawn and `Arc<T>`, `select`, bounded channels, a configurable pool or `scope(n)`, wasm threads, work stealing.

[All work packages](index.md)
