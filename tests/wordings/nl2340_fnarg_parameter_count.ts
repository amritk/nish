// NL2340: a named function whose parameter list does not match the function
// type: it takes two where the parameter says one.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);

const add = (a: i32, b: i32): i32 => a + b;

export const main = (): i32 => apply(add, 1);
