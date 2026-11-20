# WP57: Module-scoped names

**State:** In progress · **Done:** 2 of 7 · **Design note:** [`docs/wp57-module-scoped-names.md`](https://github.com/amritk/nish/blob/main/docs/wp57-module-scoped-names.md)

## Stages

- [x] S1: a private function's or generic template's symbol qualified by its module path when it would clash, with the clash checks over the qualified symbols
- [x] S2: exported names that clash inside one package: decided, they stay refused, and nothing is built
- [ ] S3a: a struct's symbol in the type table, separate from its source name and equal to it
- [ ] S3b: every `%struct.` spelled from the struct's symbol
- [ ] S3c: member and constructor symbols spelled from their owner's symbol
- [ ] S3d: a private class or interface qualified by its module path when it would clash, with the clash checks over the symbols
- [ ] S3e: a class or interface renamed on import

## Next

S3a, a struct's symbol in the type table ([§7b](https://github.com/amritk/nish/blob/main/docs/wp57-module-scoped-names.md#7b-stages)). S3a to S3c move no IR; S3d is the stage users see, and S3e needs only S3a. S2 is settled as keep refusing ([§6](https://github.com/amritk/nish/blob/main/docs/wp57-module-scoped-names.md#6-s2-exported-names-that-clash-inside-one-package-decided-keep-refusing)). S1 is built: `src/` itself can use it one release after it ships ([§5](https://github.com/amritk/nish/blob/main/docs/wp57-module-scoped-names.md#5-the-compiler-benefits-one-release-later)).

## Not planned

Versions in a symbol's identity, qualifying every symbol whether or not it clashes.

[All work packages](index.md)
