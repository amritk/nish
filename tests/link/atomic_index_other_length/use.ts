import { AtomicI32Array } from "nish/threads"

/** One element of `a`, tested against `b`'s length. */
export const bump = (a: AtomicI32Array, b: AtomicI32Array, i: i32): void => {
  if (i >= 0 && i < b.length) {
    a.add(i, 1)
  }
}
