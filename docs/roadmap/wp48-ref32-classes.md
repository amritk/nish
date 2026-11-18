# WP48: 32-bit references for linked classes

**State:** In progress · **Done:** 5 of 9 · **Design note:** [`docs/wp48-ref32-classes.md`](https://github.com/amritk/nish/blob/main/docs/wp48-ref32-classes.md)

## Stages

- [x] Designed and measured: a compact class keeps its instances in one reserved range, 4-byte aligned, and a field of that class's type is an `i32` offset; prototyped on the generated IR, `bench/goose/tree.ts` at n = 24 takes 0.50x the memory and 0.61x the time, and a pointer-chasing loop in cache pays up to a quarter more for the decode
- [x] Stage 1: the arena on a reserved range, switched on only by a compact class, with no IR moved for any program
- [x] Stage 2a: `implements Compact` from `nish:compact`, the `i32` layout of a compact class's links in any class, the encode and decode in field loads and stores (no operator takes a link, so no compound assignment reaches one), the 4-rounding allocation through `@nish_alloc_ref`, and the refusals (C and N-API surfaces, `declare class`, a `Secret` field, a generic class), each with its code; wasm32, host page modules and ASAN builds stay uncompressed
- [x] Stage 2b: a link's loads and stores tagged under a `ref32` TBAA node beside `i32`, so `opt -O2` forwards an `i32` field across a link store; `-g` types a link `ref32 <Class>`, and `tools/gdb/ref32.py` and `tools/lldb/ref32.py` show it as the object it names, on both decode shapes; `bench/goose/tree.ts` at n = 24 builds to the same binary with or without the node
- [ ] Stage 2c: the opaque C header, so a compact class can cross `--emit-header`
- [ ] Stage 3: the compiler picks compact classes by itself (a native executable, a link field, a byte saving, made in a loop or recursion), with `implements Wide` and `--compact off` to refuse; gated on the corpus showing no program slower. Prepared: `nish --explain-layout` reports which classes the rule picks, and changes no IR
- [ ] Stage 4: the `bench/goose` tree programs, `bench/wp48-refs/sibling.ts` and the guide's memory page
- [ ] Stage 5: inside Nish: which of the compiler's and `std/`'s own classes the rule picks, measured on a self-build and the `std/` benches, with `implements Compact` or `Wide` where the measurement disagrees with the rule (in `src/` only after the release that ships the markers)
- [x] Stage 6: a class pointer field on wasm32 laid out in 4 bytes, not 8 (found by the survey, independent of stages 1 to 5); a class's size, alignment and field offsets on wasm32 are LLVM's, and native IR does not move

## Next

Stage 2c, the opaque C header, so a compact class can cross `--emit-header`: [§4](https://github.com/amritk/nish/blob/main/docs/wp48-ref32-classes.md#4-the-invariants-one-by-one).

## Not planned

A whole-program 32-bit mode, compressing locals, parameters, returns, `Map` keys or generic `T`, a compact class on the stack, a compact field in a `declare class`.

[All work packages](index.md)
