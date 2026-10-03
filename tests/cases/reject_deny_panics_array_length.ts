// --deny-panics refuses `new Array(n)` with a length type it has to check, and
// names the types that need no check.
export const make = (n: i64): i32[] => new Array<i32>(n);
