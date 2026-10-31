// `xs.sort(cmp)` is `sortWith(xs, cmp)` from `std/sort.ts`, instantiated for
// this comparator and copied into this module: the merge and the insertion
// loops call `@ascending` directly.
const ascending = (a: i32, b: i32): number => a - b

export const sortScores = (xs: i32[]): i32[] => xs.sort(ascending)
