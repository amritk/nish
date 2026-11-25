import { AtomicI32Array } from "nish/threads"

/** One element, with only the upper bound tested. */
export const bump = (a: AtomicI32Array, i: i32): void => {
  if (i < a.length) {
    a.add(i, 1)
  }
}
