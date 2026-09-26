// NL2383: a literal entering a range it lies outside.
const first = (xs: integer<1, 12>[]): i32 => xs[0]

export const main = (): i32 => first([0])
