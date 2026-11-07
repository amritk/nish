// The module half of tests/page: two rings in module storage, one the page
// fills and the module drains, one the module fills and the page drains,
// both through `nish/host/ring` here and `nish/page`'s `ringOver` there.
import { ringPush, ringShift, ringSize } from "nish/host/ring"

const INPUT = new Int32Array(2 + 4)
const OUTPUT = new Int32Array(2 + 4)

/** Moves every waiting input word to the output, doubled; answers how many moved. */
export function tick(): i32 {
  let moved: i32 = 0
  while (ringSize(INPUT) > 0 && ringPush(OUTPUT, ringShift(INPUT) * 2)) {
    moved++
  }
  return moved
}

/** Pushes `from`, `from + 1`, ... onto the output until it is full; answers how many went. */
export function fill(from: i32): i32 {
  let n: i32 = 0
  while (ringPush(OUTPUT, from + n)) {
    n++
  }
  return n
}

/** The input ring's size as the module reads it. */
export function waiting(): i32 {
  return ringSize(INPUT)
}
