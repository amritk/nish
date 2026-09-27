// WP31 §4: `integer` takes exactly two bounds, and one is not a range.
const f = (x: integer<0>): i32 => x

export const main = (): number => f(0)
