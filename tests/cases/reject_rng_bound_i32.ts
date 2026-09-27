// WP31 §5: a ranged value is always an `i32`, so both bounds lie in it; the
// upper half of `u32` is what `u32` is for.
const f = (x: integer<0, 4294967295>): i32 => x

export const main = (): number => f(0)
