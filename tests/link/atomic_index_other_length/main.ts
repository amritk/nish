// `atomic_index_proven`'s guard against another array's length: `i <
// b.length` says nothing about `a`, so the `add`'s `index` site in
// `use.ts`, which `noPanic` lists, stays unproven and is refused.
import { AtomicI32Array } from "nish/threads"
import { bump } from "./use"

export const main = (): i32 => {
  bump(new AtomicI32Array(4), new AtomicI32Array(8), parseInt("1"))
  return 0
}
