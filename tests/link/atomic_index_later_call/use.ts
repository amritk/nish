import { AtomicI32Array } from "nish/threads"
import { shrink } from "./shrink"

/** A shared array of bins, which `shrink` swaps for its shorter spare. */
export class Box {
  bins: AtomicI32Array
  spare: AtomicI32Array

  constructor(bins: AtomicI32Array, spare: AtomicI32Array) {
    this.bins = bins
    this.spare = spare
  }
}

/** Stores into element `i` of the bins a call swaps out, then loads element `i` again. */
export const swap = (s: Box, i: i32): i32 => {
  if (i >= 0 && i < s.bins.length) {
    s.bins.store(i, shrink(s))
    return s.bins.load(i)
  }
  return -1
}
