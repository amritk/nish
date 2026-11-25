// `atomic_index_proven`'s guard without its upper bound: `i >= 0` alone
// leaves an `i` past the end, so the `add`'s `index` site in `use.ts`,
// which `noPanic` lists, stays unproven and is refused.
import { AtomicI32Array } from "nish/threads"
import { bump } from "./use"

export const main = (): i32 => {
  bump(new AtomicI32Array(4), parseInt("1"))
  return 0
}
