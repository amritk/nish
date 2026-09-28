// WP31 §4: the lower bound above the upper one is an empty range, which no
// value can enter.
const f = (x: integer<10, 0>): i32 => x

export const main = (): number => f(5)
