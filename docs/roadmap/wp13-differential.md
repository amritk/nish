# WP13: Differential testing against Node

**State:** Landed · **Done:** 1 of 2 · **Design note:** [`docs/wp13-differential.md`](https://github.com/amritk/nish/blob/main/docs/wp13-differential.md)

## Stages

- [x] The native-against-Node oracle, run from frozen rewrites, and the seed-against-HEAD IR fuzzer
- [ ] A rewriter driven by `--emit-checked`, for programs added after stage0 was removed *(deferred)*

## Next

Nothing scheduled. Any unchecked item is deferred; the note says what would reopen it.

## Not planned

Fuzzing `f64`/`i64` programs, comparing stderr.

[All work packages](index.md)
