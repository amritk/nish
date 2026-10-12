import { parallelFrom, parallelMap } from "nish/threads"

export const affine = (xs: i32[], k: i32, b: i32): i32[] => parallelMap(xs, (x) => x * k + b)

export const squares = (n: i32): i32[] => parallelFrom(n, (i) => i * i)
