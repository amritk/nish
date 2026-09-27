// WP31 §4: a type is not a bound either.
const f = (x: integer<i32, 9>): i32 => x

export const main = (): number => f(0)
