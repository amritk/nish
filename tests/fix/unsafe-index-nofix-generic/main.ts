// A generic body is checked once per instantiation, and one rewrite would have
// to hold for each: this one is instantiated with numbers and with strings.
const pick = <T>(xs: T[], k: i32): T => xs[k]

export const both = (xs: i32[], names: string[], k: i32): i32 => pick(xs, k) + pick(names, k).length
