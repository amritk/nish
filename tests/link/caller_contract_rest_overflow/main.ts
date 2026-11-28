// A window test's subtraction is an overflow site of its own: `take` reads
// `p > toI32(b.length) - q` with no `q < 0` before it, and `main` passes
// `q = -2147483647`, so `3 - q` leaves `i32` (docs/LANGUAGE.md, "Panic
// sites"). The contract proof never stands in for it: `--deny-panics`
// refuses the `-` and the `panic` behind the call nothing proves.
import { done } from "./done"

const take = (b: i32[], p: i32, q: i32): i32 => {
  if (p < 0 || p > toI32(b.length) - q) {
    panic("take: out of range")
  }
  return p
}

export const main = (): i32 => {
  const b: i32[] = [1, 2, 3]
  console.log(`${take(b, 1, -2147483647)}`)
  console.log(done())
  return 0
}
