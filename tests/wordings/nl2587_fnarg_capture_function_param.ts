// NL2587: an arrow argument names a function parameter of the function it is
// written in, which is no value it can be handed.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);
const twiceThenOne = (g: (x: i32) => i32, x: i32): i32 => apply((v) => g(g(v)) + 1, x);
export const main = (): i32 => twiceThenOne((x) => x * 2, 1);
