import { AtomicI32Array } from "nish/threads"

/** Stores `k` into element `i`, moving `i` to `k` as it does, then reads `x[i]`. */
export const move = (a: AtomicI32Array, x: i32[], i0: i32, k: i32): i32 => {
  let i = i0
  if (i >= 0 && i < a.length) {
    a.store(i, (i = k))
    if (i < x.length) {
      return x[i]
    }
  }
  return -1
}
