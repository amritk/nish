import { AtomicI32Array } from "nish/threads"

/** Stores into element `j`, which a later argument rebinds to the tested `k`. */
export const poke = (a: AtomicI32Array, i: i32, k: i32): i32 => {
  let j: i32 = i
  if (k >= 0 && k < a.length) {
    a.store(j, (j = k))
    return j
  }
  return -1
}
