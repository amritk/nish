// `atomic_index_proven`'s guard on `r`, with `r` rebound to a shorter array
// before the `load`: the assignment drops what the guard said about `r`'s
// length, as it does for an array, so the `load`'s `index` site in `use.ts`,
// which `noPanic` lists, stays unproven and is refused.
import { AtomicI32Array } from "nish/threads"
import { peek } from "./use"

export const main = (): i32 => {
  return peek(new AtomicI32Array(8), new AtomicI32Array(2), parseInt("5"))
}
