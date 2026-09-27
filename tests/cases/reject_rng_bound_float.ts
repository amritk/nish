// WP31 §4: a bound is an integer, in the words `reject_i64_literal_float` uses.
const f = (x: integer<0, 1.5>): i32 => x

export const main = (): number => f(0)
