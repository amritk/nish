import { AtomicI32Array } from "nish/threads"

export const count = (bins: AtomicI32Array, x: i32): i32 => {
  bins.add(x & 15, 1)
  return bins.load(0)
}
