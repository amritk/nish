# WP66: C libraries from their headers

**State:** In progress · **Done:** 1 of 7 · **Design note:** [`docs/wp66-c-headers.md`](https://github.com/amritk/nish/blob/main/docs/wp66-c-headers.md)

## Stages

- [ ] S1: `zeroext` on `u8`, `u16` and `boolean` parameters and results of a `declare function` ([#1755](https://github.com/amritk/nish/issues/1755))
- [ ] S2: `nish c-import`: a header read through clang becomes a Nish module of `declare function`s, `declare class`es, out classes and constants, with an override file and a list of what was not bound
- [ ] S3: opaque classes: a field-less `declare class` C can return, so one C pointer type is not passed where another is wanted
- [ ] S4: fixed-length array fields in a `declare class`
- [x] S5: a buffer paired with its count by name, with a count of any unsigned width
- [ ] S6: C callbacks: a top-level function named at the call, passed as a C function pointer *(open question)*
- [x] S7: a package links a C library or C sources of its own, under `nish run` and `--link`

## Next

S1: [§8, S1](https://github.com/amritk/nish/blob/main/docs/wp66-c-headers.md#s1-zeroext-on-narrow-foreign-parameters). S2 follows it. S3 and S4 do not depend on one another; S5 and S7 are done.

## Open questions

What C may do with a callback: call it on another thread, after the registering call has returned, or with a panic unwinding through its frames (S6). [§8, S6](https://github.com/amritk/nish/blob/main/docs/wp66-c-headers.md#s6-callbacks-open-question). The owner's other decisions, D1 to D7, are in [§9](https://github.com/amritk/nish/blob/main/docs/wp66-c-headers.md#9-decisions-for-the-owner).

## Not planned

Variadic functions, function-like macros, unions, bitfields, `long double`, C++ headers, and an `import` of a header at compile time unless the note's S6 question is answered for it.

[All work packages](index.md)
