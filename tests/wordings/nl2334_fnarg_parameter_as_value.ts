// NL2334: a function parameter used as a value. It names a callee chosen at
// compile time, so it can be called or passed on, and a comparison is as
// much a value use as a store.
const same = (f: (x: i32) => i32, g: (x: i32) => i32): boolean => f === g;

const inc = (x: i32): i32 => x + 1;

export const main = (): i32 => (same(inc, inc) ? 1 : 0);
