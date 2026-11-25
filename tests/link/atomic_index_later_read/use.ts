import { AtomicI32Array } from "nish/threads"

/** Stores `x[i]` into element `i`, under a guard on `x`'s upper end only. */
export const copy = (a: AtomicI32Array, x: i32[], i: i32): i32 => {
  if (i < x.length) {
    a.store(i, x[i])
    return 0
  }
  return -1
}
