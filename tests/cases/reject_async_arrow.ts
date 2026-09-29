// An `async` arrow written as an argument: the modifier stands before the
// arrow's parameters on its line, which a call of a function named `async`
// never has an `=>` after (NL1015).
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x)

export const main = (): i32 => apply(async (x) => x + 1, 1)
