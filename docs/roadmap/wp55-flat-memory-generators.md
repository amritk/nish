# WP55: Generators whose memory stays flat: a string builder, and a region per file

**State:** Accepted · **Done:** 0 of 5 · **Design note:** [`docs/wp55-flat-memory-generators.md`](https://github.com/amritk/nish/blob/main/docs/wp55-flat-memory-generators.md)

## Stages

- [ ] S0: the baseline, a 25 MB spec, a generator written two ways, and peak memory at 1,000 to 8,000 files
- [ ] S1: the patterns with today's tools, a guide page, cookbook entries, file I/O inside a region tested
- [ ] S2: `builder()` from `nish:string`, whose bytes live outside the arena and whose appends keep a loop's scope
- [ ] S3: files from a builder, `writeFileSync` of a builder and a write handle that flushes
- [ ] S4: the diagnostics name the builder, and the flat-memory gate runs in CI

## Next

S0, the baseline: [§8 The proof](https://github.com/amritk/nish/blob/main/docs/wp55-flat-memory-generators.md#8-the-proof). Every open question is decided ([§10](https://github.com/amritk/nish/blob/main/docs/wp55-flat-memory-generators.md#10-decisions)).

## Not planned

A rope `string`, appending in place to the arena, a collector.

[All work packages](index.md)
