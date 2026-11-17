# WP65: The surface a lexer port asked for

**State:** Proposed · **Done:** 1 of 5 · **Design note:** [`docs/wp65-lexer-surface.md`](https://github.com/amritk/nish/blob/main/docs/wp65-lexer-surface.md)

## Stages

- [x] Array module constants for a byte-class table: built before this package as [constant tables](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#constant-tables) (`const CLASS: readonly u8[] = [...]`); the docs that show them to a lexer author land with S1
- [ ] S1: byte search on `u8[]`: `indexOf(x, fromIndex)` on every array, lowered to `memchr` on a byte array, and `indexOfByte`, `equalBytes` and `compareBytes` in `std/bytes` through `memchr` and `memcmp`
- [ ] S2: allocation without the zero fill: `withCapacity` and `grow` in `std/array`, then a fill dropped where a counted loop overwrites it before any read, measured on its own
- [ ] S3: field initializers that are not literals (`xs: i32[] = []`), run in declaration order before the constructor body
- [ ] S4: `toString()` on a number *(open question)*

## Next

S1: [§2](https://github.com/amritk/nish/blob/main/docs/wp65-lexer-surface.md#2-byte-search-on-u8-s1). S1, S2 and S3 do not depend on one another and can land in any order.

## Open questions

Whether to build `n.toString()` (and `String(n)`), which LANGUAGE.md refuses on purpose today, or keep the rule and make the refusal name the template literal (D1). [§5](https://github.com/amritk/nish/blob/main/docs/wp65-lexer-surface.md#5-tostring-on-a-number-s4-open-question).

## Not planned

An array whose `length` covers uninitialised slots; `memchr` for elements wider than a byte; `toString` on arrays or classes.

[All work packages](index.md)
