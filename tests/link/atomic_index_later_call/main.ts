// A `store` whose second argument is a call that swaps the bins it stores
// into: `shrink` runs before the method checks `i` against the eight-element
// array it was called on, and leaves `s.bins` one element long. That check
// says nothing of the new `s.bins`, so the `load` after it is not proven, and
// `use.ts`, which `noPanic` lists, may not keep its check. Recording the
// `store`'s check past an argument that calls would list the `load` as proven
// while `i = 5` makes it panic on a one-element array.
import { AtomicI32Array } from "nish/threads"
import { Box, swap } from "./use"

export const main = (): i32 => {
  return swap(new Box(new AtomicI32Array(8), new AtomicI32Array(1)), parseInt("5"))
}
