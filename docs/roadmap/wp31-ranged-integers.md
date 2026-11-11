# WP31: Ranged integers

**State:** Landed · **Done:** 1 of 4 · **Design note:** [`docs/wp31-ranged-integers.md`](https://github.com/amritk/nish/blob/main/docs/wp31-ranged-integers.md)

## Stages

- [x] W1 to W4: `integer<Lo, Hi>`, its range proofs, the host-boundary `RangeError` and the acceptance program ([#261](https://github.com/amritk/nish/pull/261) to [#274](https://github.com/amritk/nish/pull/274))
- [ ] A lower-bound fact family, `i >= n` *(deferred)*
- [ ] Merging instantiations that differ only by range *(deferred)*
- [ ] `x & 255` and `Math.min(x, 255)` as fact sources *(deferred)*

## Next

Nothing scheduled. Any unchecked item is deferred; the note says what would reopen it.

## Not planned

A constant as a range bound, length floors in types.

[All work packages](index.md)
