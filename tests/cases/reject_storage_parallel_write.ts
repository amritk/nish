// A parallel body that writes module storage writes memory every thread can
// see, so `parallelMap` refuses it as it refuses any other shared write.
import { parallelMap } from "nish/threads"
const HITS = new Int32Array(4)
export const main = (): i32 => {
  const ys = parallelMap([1, 2, 3], (x: i32): i32 => {
    HITS[0] = x
    return x * 2
  })
  return ys[0]
}
