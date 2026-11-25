// `atomic_index_proven`'s guard on `k`, with the index `j` rebound to `k` by
// the call's own second argument: the method is passed `j`'s old value, which
// nothing tested, so the `store`'s `index` site in `use.ts`, which `noPanic`
// lists, stays unproven and is refused. Judging the index after every argument
// had run would take `j = k`'s fact for it and accept an index out of range.
import { AtomicI32Array } from "nish/threads"
import { poke } from "./use"

export const main = (): i32 => {
  return poke(new AtomicI32Array(4), parseInt("1000000"), parseInt("0"))
}
