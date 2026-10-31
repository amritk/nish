// A function parameter is a compile-time binding, not a value an arrow can be
// handed, so an arrow argument may not name one of its function's.
const apply = (f: (x: i32) => i32, x: i32): i32 => f(x);
const twiceThenOne = (g: (x: i32) => i32, x: i32): i32 => apply((v) => g(g(v)) + 1, x);
export const main = (): i32 => twiceThenOne((x) => x * 2, 1);
