// `xs.map(f)` is `map(xs, f)` from `std/array.ts`, instantiated for this
// callback and copied into this module: the loop calls `@double` directly.
const double = (x: i32): i32 => x * 2

export const doubled = (xs: readonly i32[]): i32[] => xs.map(double)
