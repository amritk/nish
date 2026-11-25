import { AtomicI32Array } from "nish/threads"

/** One element, unguarded. */
export const bump = (a: AtomicI32Array, i: i32): i32 => a.load(i)
