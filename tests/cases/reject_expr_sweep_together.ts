// The expressions the checker refuses are a pass 1 sweep, which recovers per
// declaration: each declaration that holds one reports it once and nothing
// else. `K` is its hole rather than its missing annotation, `square` reports
// one of its two `**`, and `make` its spread. `tests/run.js` pins the three
// through `--json`.
export const K = [1, , 2]

export const square = (n: i32): i32 => n ** 2 ** 1

export const make = (): i32[] => [...[1], 2]
