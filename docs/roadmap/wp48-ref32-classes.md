# WP48: 32-bit references for an opt-in class

**State:** Proposed · **Done:** 1 of 5 · **Design note:** [`docs/wp48-ref32-classes.md`](https://github.com/amritk/nish/blob/main/docs/wp48-ref32-classes.md)

## Stages

- [x] Designed and measured: a class marked `implements Compact` keeps its instances in one reserved range, 4-byte aligned, and a field of that class's type is an `i32` offset; prototyped on the generated IR, `bench/goose/tree.ts` at n = 24 takes 0.50x the memory and 0.61x the time, and a pointer-chasing loop in cache pays up to a quarter more for the decode
- [ ] Stage 1: the arena on a reserved range, switched on only by a compact class, with no IR moved for any program
- [ ] Stage 2: the marker, the `i32` field layout, the decode and encode in field loads and stores, the 4-rounding allocation, attributes, TBAA, debug info, the opaque C header and the refusals
- [ ] Stage 3: the `bench/goose` tree programs, `bench/wp48-refs/sibling.ts` and the guide's memory page
- [ ] Stage 4: a class pointer field on wasm32 laid out in 4 bytes, not 8 (found by the survey, independent of stages 1 to 3)

## Next

The owner's decision on the note's [open questions](https://github.com/amritk/nish/blob/main/docs/wp48-ref32-classes.md#7-open-decisions), then stage 1: [§3.3](https://github.com/amritk/nish/blob/main/docs/wp48-ref32-classes.md#33-the-arena-on-a-reserved-range).

## Not planned

A whole-program 32-bit mode, compressing locals, parameters, returns, `Map` keys or generic `T`, a compact class on the stack, a compact field in a `declare class`.

[All work packages](index.md)
