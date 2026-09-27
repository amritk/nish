// WP31 §4 and §11: a bound is an integer literal. A constant is a value, and a
// type argument cannot name one, so `integer<0, MAX>` is refused here.
const MAX: i32 = 9

const f = (x: integer<0, MAX>): i32 => x

export const main = (): number => f(0)
