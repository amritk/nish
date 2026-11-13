# WP55: Generators whose memory stays flat: a string builder, and a region per file

**State:** Proposed · **Done:** 0 of 5 · **Design note:** [`docs/wp55-flat-memory-generators.md`](https://github.com/amritk/nish/blob/main/docs/wp55-flat-memory-generators.md)

## Stages

- [ ] S0: the baseline, a 25 MB spec, a generator written two ways, and peak memory at 1,000 to 8,000 files
- [ ] S1: the patterns with today's tools, a guide page, cookbook entries, file I/O inside a region tested
- [ ] S2: `StringBuilder`, whose bytes live outside the arena and whose appends keep a loop's scope
- [ ] S3: files from a builder, `writeFileSync` of a builder and a write handle that flushes
- [ ] S4: the diagnostics name the builder, and the flat-memory gate runs in CI

## Next

S0, which needs no decision: [§8 The proof](https://github.com/amritk/nish/blob/main/docs/wp55-flat-memory-generators.md#8-the-proof). S2 waits on the questions below.

## Waiting on a decision

The builder's name and module, whether its storage is owned by the arena or by `using`, threads, number appends, and wasm32. Spec: [§10 Open questions](https://github.com/amritk/nish/blob/main/docs/wp55-flat-memory-generators.md#10-open-questions-for-the-owner).

## Not planned

A rope `string`, appending in place to the arena, a collector.

[All work packages](index.md)
