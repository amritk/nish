// WP31 §5: the lower end of `i32` is -2147483648, and one below it is refused
// with its sign.
const f = (x: integer<-2147483649, 0>): i32 => x

export const main = (): number => f(0)
