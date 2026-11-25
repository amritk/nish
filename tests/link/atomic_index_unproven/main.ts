// An atomic array's element index nothing proves (docs/LANGUAGE.md, "Atomic
// arrays"). `i` is a parameter with no guard, so the `index` site of the
// `load` in `use.ts`, which `noPanic` lists, stays unproven and is refused.
// `atomic_index_proven` is the call guarded.
import { AtomicI32Array } from "nish/threads"
import { bump } from "./use"

export const main = (): i32 => {
  console.log(bump(new AtomicI32Array(4), parseInt("1")))
  return 0
}
