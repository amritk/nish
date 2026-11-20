# WP66: C libraries from their headers

**State:** Landed · **Open work:** [#1996](https://github.com/amritk/nish/issues/1996) · **Design note:** [`docs/wp66-c-headers.md`](https://github.com/amritk/nish/blob/main/docs/wp66-c-headers.md)

## Stages

- [x] S1: `zeroext` on `u8`, `u16` and `boolean` parameters and results of a `declare function` ([#1755](https://github.com/amritk/nish/issues/1755))
- [x] S2: `nish c-import`: a header read through clang becomes a Nish module of `declare function`s, `declare class`es, out classes and constants, with an override file and a list of what was not bound
- [x] S3: opaque classes: a field-less `declare class` C can return, so one C pointer type is not passed where another is wanted
- [x] S4: fixed-length array fields in a `declare class`
- [x] S5: a buffer paired with its count by name, with a count of any unsigned width
- [x] S7: a package links a C library or C sources of its own, under `nish run` and `--link`
- [x] S8: `nish c-import` writes opaque classes, array fields and named buffer pairs

## Open work

Open stages are the sub-issues of [#1996](https://github.com/amritk/nish/issues/1996), one pull request each, specified in [`.claude/plans/wp66-c-headers.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp66-c-headers.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

Variadic functions, function-like macros, unions, bitfields, `long double`, C++ headers, and an `import` of a header at compile time unless the note's S6 question is answered for it.

[All work packages](index.md)
