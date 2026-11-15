# WP58: A discriminated union as a generic's type argument

**State:** Landed · **Done:** 1 of 1

## Stages

- [x] S1: lift NL2533 — `Box<Shape>`, `Result<Shape, E>`, a generic call bound to a union and `getOrInsert`/`reserve` on a `Map<K, Shape>` compile and run; a variant enters the union with a bitcast at every generic payload site, so `Box<Shape>` is the same IR as a hand-written `ShapeBox` (`docs/IR_COOKBOOK.md`), and `Result<Shape, string>` allocates a fifth less than the wrapper it replaces (`docs/BENCHMARKS.md`)

A union is still refused as a `Set` element or `Map` key (NL2353), a generic class as a variant (NL2522), a variant stored through a generic field (NL2534), and across the C header and N-API boundary (NL4009); [`docs/LANGUAGE.md`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md) lists the rest.

## Next

Nothing scheduled.

[All work packages](index.md)
