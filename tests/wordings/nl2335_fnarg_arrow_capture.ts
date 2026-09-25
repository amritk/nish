// NL2335: an arrow argument that reads a parameter of the function it is
// written in. It is lifted into a function of its own, so there is nothing to
// read it through.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

const offset = (base: i32): i32 => apply((x) => x + base, 1);

export const main = (): i32 => offset(2);
