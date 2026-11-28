// A caller contract handed to a std generic: `map(xs, half)` calls `half`
// on each element inside `std/array.ts`, a call that names no function, so
// `half`'s guard sees no caller's test there. `main`'s direct call
// `half(4)` is proven, yet `half`'s `panic` stays its own: proven: false.
import { map } from "nish/array"
import { done } from "./done"

const half = (x: i32): i32 => {
  if (x < 0) {
    panic("half: negative")
  }
  return x / 2
}

export const main = (): i32 => {
  const xs: i32[] = [2, 4, 6]
  const ys = map(xs, half)
  console.log(`${half(4)} ${ys.length}`)
  console.log(done())
  return 0
}
