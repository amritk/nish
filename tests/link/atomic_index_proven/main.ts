// An atomic array's element index the caller proves (docs/LANGUAGE.md,
// "Atomic arrays"). Each element method checks its index in its body, and
// the check is an `index` site of the call, proven by the guard or the loop
// test around it. `use.ts`, which `noPanic` lists, makes every call and builds;
// this module constructs the arrays, whose constructor keeps a panic for a
// negative length, so it stays outside the scope. The `atomic_index_*`
// negatives each leave one fact of the proof out.
import { AtomicI32Array, AtomicI64Array } from "nish/threads"
import { Counts, bump, bump64, fill, show } from "./use"

export const main = (): i32 => {
  const a = new AtomicI32Array(4)
  fill(a)
  console.log(bump(a, 1))
  console.log(bump(a, 4))
  show(a)
  const counts = new Counts(new AtomicI64Array(2))
  counts.addTwo()
  counts.show()
  console.log(bump64(new AtomicI64Array(3), 2))
  console.log(bump64(new AtomicI64Array(3), 3))
  return 0
}
