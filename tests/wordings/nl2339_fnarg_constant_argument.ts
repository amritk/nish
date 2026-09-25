// NL2339: a module constant passed where a function is wanted is named as a
// constant, not as an unknown function; a constant is never a function.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

const notAFunction: i32 = 5;

export const main = (): i32 => apply(notAFunction, 3);
