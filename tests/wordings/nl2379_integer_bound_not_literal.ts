// NL2379: a bound of `integer<Lo, Hi>` that is a name rather than a literal.
const LIMIT: i32 = 9

const f = (x: integer<0, LIMIT>): i32 => x

export const main = (): i32 => f(0)
