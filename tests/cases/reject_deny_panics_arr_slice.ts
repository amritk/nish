// --deny-panics refuses an array `slice` whose bounds nothing tests: the range
// check is `std/array.ts`'s, judged at the call as a string `slice` is, and
// `a` and `b` are parameters no guard bounds. The advice names the guard.
export const part = (xs: number[], a: number, b: number): number[] => xs.slice(a, b)
