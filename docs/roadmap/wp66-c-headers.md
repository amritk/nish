# WP66: C libraries from their headers

**State:** In progress · **Done:** 7 of 8 · **Design note:** [`docs/wp66-c-headers.md`](https://github.com/amritk/nish/blob/main/docs/wp66-c-headers.md)

## Stages

- [x] S1: `zeroext` on `u8`, `u16` and `boolean` parameters and results of a `declare function` ([#1755](https://github.com/amritk/nish/issues/1755))
- [x] S2: `nish c-import`: a header read through clang becomes a Nish module of `declare function`s, `declare class`es, out classes and constants, with an override file and a list of what was not bound
- [x] S3: opaque classes: a field-less `declare class` C can return, so one C pointer type is not passed where another is wanted
- [x] S4: fixed-length array fields in a `declare class`
- [x] S5: a buffer paired with its count by name, with a count of any unsigned width
- [ ] S6: C callbacks: a top-level function named at the call, passed as a C function pointer *(open question)*
- [x] S7: a package links a C library or C sources of its own, under `nish run` and `--link`
- [x] S8: `nish c-import` writes opaque classes, array fields and named buffer pairs

## Next

S6, once its open question is settled: [§8](https://github.com/amritk/nish/blob/main/docs/wp66-c-headers.md#8-what-the-language-needs-in-order-of-what-it-unlocks). S1 to S5, S7 and S8 are done.

## Open questions

What C may do with a callback: call it on another thread, after the registering call has returned, or with a panic unwinding through its frames (S6). [§8, S6](https://github.com/amritk/nish/blob/main/docs/wp66-c-headers.md#s6-callbacks-open-question). The owner's other decisions, D1 to D7, are in [§9](https://github.com/amritk/nish/blob/main/docs/wp66-c-headers.md#9-decisions-for-the-owner).

## Not planned

Variadic functions, function-like macros, unions, bitfields, `long double`, C++ headers, and an `import` of a header at compile time unless the note's S6 question is answered for it.

[All work packages](index.md)
