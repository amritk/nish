# WP46: Memory for programs that do not exit: regions

**State:** Landed · **Done:** 4 of 4 · **Design note:** [`docs/wp46-long-running-memory.md`](https://github.com/amritk/nish/blob/main/docs/wp46-long-running-memory.md)

## Stages

- [x] Stage 1: regions in the runtime
- [x] Stage 2: `nish:region` and its checker rules
- [x] Child regions, freed with their parent ([#1357](https://github.com/amritk/nish/pull/1357))
- [x] Stage 3: the sessions server on regions, a soak flat over 2,000,000 requests

## Next

Nothing: every stage has landed. What is left is under Not planned.

## Not planned

`Rc<T>`, `std/net`'s slot pools on regions.

[All work packages](index.md)
