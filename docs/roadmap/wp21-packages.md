# WP21: Packages

**State:** In progress · **Done:** 3 of 7 · **Design note:** [`docs/wp21-packages.md`](https://github.com/amritk/nish/blob/main/docs/wp21-packages.md)

## Stages

- [x] S1: package-scoped symbols ([#57](https://github.com/amritk/nish/pull/57))
- [x] S2: bare specifiers and the `nish` export condition
- [x] S3: resolution diagnostics and package identity, a module is its real path
- [ ] S3: an error naming the package when a builtin has no runtime on the target (`readFileSync` on wasm)
- [ ] S3: a compile error inside `node_modules/<pkg>` attributed to that dependency
- [ ] S4: the build cache, keyed by package version, number mode, target, profile and compiler
- [ ] S5: prebuilt distribution *(deferred)*

## Next

S3's first item: the error for a builtin the target has no runtime for. Spec: [§8 Stages](https://github.com/amritk/nish/blob/main/docs/wp21-packages.md#8-stages).

## Not planned

Diamond dependencies and two copies of one package, a separate resolver tool.

[All work packages](index.md)
