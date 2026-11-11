# WP48: Compressed 32-bit references

**State:** Landed · **Done:** 2 of 4 · **Design note:** [`docs/wp48-compressed-references.md`](https://github.com/amritk/nish/blob/main/docs/wp48-compressed-references.md)

## Stages

- [x] Measured: `bench/wp48-refs/`
- [x] The lean sibling-link layout as the convention for ports
- [ ] A presized record array and a nominal `i32` *(deferred)*
- [ ] Design A, 32-bit references, if a port runs out of memory *(deferred)*

## Next

Nothing is scheduled. The owner accepted [§4](https://github.com/amritk/nish/blob/main/docs/wp48-compressed-references.md#4-recommendation)
on 2026-11-11: build neither design, and write ports in the lean layout
(`docs/AI.md`, "A tree links first child and next sibling").

- The presized record array and the nominal `i32` reopen as their own
  proposals, when a port needs records in an array without growth garbage
  or a typed handle that costs nothing.
- Design A reopens when a port written in the lean layout measures out of
  memory. Its first step is the arena on a reserved range, then the decode
  cost measured on `sibling.ts`.

[All work packages](index.md)
