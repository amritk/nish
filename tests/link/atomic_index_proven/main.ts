// An atomic array's element index the caller proves (docs/LANGUAGE.md,
// "Atomic arrays"). Each element method checks its index as `a[i]` is
// checked, and the check is an `index` site of the call, proven where `a[i]`
// would be. `use.ts`, which `noPanic` lists, makes every call and builds;
// this module constructs the arrays, whose constructor keeps a panic for a
// negative length, so it stays outside the scope. The `atomic_index_*`
// negatives each leave one fact of the proof out.
import { AtomicI32Array, AtomicI64Array } from "nish/threads"
import { Counts, bump, fill, show } from "./use"

export const main = (): i32 => {
  const a = new AtomicI32Array(4)
  fill(a)
  console.log(bump(a, 1))
  console.log(bump(a, 4))
  show(a)
  const counts = new Counts(new AtomicI64Array(2))
  counts.addTwo()
  counts.show()
  return 0
}
