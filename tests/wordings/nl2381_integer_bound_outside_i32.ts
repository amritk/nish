// NL2381: a bound of `integer<Lo, Hi>` that does not fit in `i32`.
const f = (x: integer<0, 0x80000000>): i32 => x

export const main = (): i32 => f(0)
