import { AtomicI32Array } from "nish/threads"

/** One element, with only the lower bound tested. */
export const bump = (a: AtomicI32Array, i: i32): void => {
  if (i >= 0) {
    a.add(i, 1)
  }
}
