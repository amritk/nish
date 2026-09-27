// NL2380: a bound of `integer<Lo, Hi>` with a fraction.
const f = (x: integer<0.5, 9>): i32 => x

export const main = (): i32 => f(1)
