import { AtomicI32Array } from "nish/threads"

/** Loads element `i` of `b`, through a local the guard tested as `a`. */
export const peek = (a: AtomicI32Array, b: AtomicI32Array, i: i32): i32 => {
  let r = a
  if (i >= 0 && i < r.length) {
    r = b
    return r.load(i)
  }
  return -1
}
