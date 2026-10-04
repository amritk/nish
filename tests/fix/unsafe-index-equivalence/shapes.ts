// Every other rewritten shape, so that each one is compiled and run without
// the flag by tests/link/unsafe-migrate-index-fixed. The module already
// imports `uncheckedGet`, so the fix extends that import with `uncheckedSet`.
import { uncheckedGet } from "nish:unsafe"

// A read through a readonly array, with an index of a range over i32.
export const pick = (xs: readonly f64[], k: integer<0, 3>): f64 => xs[k]

// `grid[r][c]`: the access to the inner array of numbers is rewritten, and
// `grid[r]` keeps its check.
export const cell = (grid: i32[][], r: i32, c: i32): i32 => grid[r][c]

// A compound store on bytes, which wraps as u8 arithmetic does, and a store
// in parentheses.
export const stir = (bytes: u8[], k: i32, v: u8): u8 => {
  bytes[k] += 200
  ;(bytes[k + 1] = v)
  return uncheckedGet(bytes, k)
}
