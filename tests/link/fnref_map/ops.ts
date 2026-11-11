// The exporter of the function type and the functions `main.ts` keeps in a
// `Map`, and of `run`, which calls one it is handed.
export type Op = (x: i32) => i32

export const inc = (x: i32): i32 => x + 1

export const big = (x: i32): i32 => x + 100

export const run = (op: Op, x: i32): i32 => op(x)
