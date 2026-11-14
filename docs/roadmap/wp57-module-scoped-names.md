# WP57: Module-scoped names

**State:** Proposed · **Done:** 0 of 3 · **Design note:** [`docs/wp57-module-scoped-names.md`](https://github.com/amritk/nish/blob/main/docs/wp57-module-scoped-names.md)

## Stages

- [ ] S1: a private function's or generic template's symbol qualified by its module path when it would clash, with the clash checks over the qualified symbols
- [ ] S2: exported names that clash inside one package and are not on the C surface *(open question)*
- [ ] S3: module-scoped class and interface names, with type identity (module, name)

## Next

S1, private functions and generic templates: [§4](https://github.com/amritk/nish/blob/main/docs/wp57-module-scoped-names.md#4-s1-private-functions-and-generic-templates). `src/` itself can use it one release after it ships ([§5](https://github.com/amritk/nish/blob/main/docs/wp57-module-scoped-names.md#5-the-compiler-benefits-one-release-later)).

## Waiting on a decision

S2: keep refusing, make only the entry's exports the C surface, qualify in a closed-world build only, or give each a chosen C name ([§6](https://github.com/amritk/nish/blob/main/docs/wp57-module-scoped-names.md#6-s2-exported-names-that-clash-inside-one-package-open-question)).

## Not planned

Versions in a symbol's identity, qualifying every symbol whether or not it clashes.

[All work packages](index.md)
