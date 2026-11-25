// A guard on `i < x.length` only, with `x[i]` read by the `store`'s own
// second argument. The `store` checks `0 <= i < a.length` in its body, after
// every argument has run, so nothing it checks may prove `x[i]`'s lower end:
// the read in `use.ts`, which `noPanic` lists, stays unproven and is refused.
// Recording the `store`'s check once its index was evaluated would drop the
// read's lower-bound check, and `i = -5` would read `x[-5]`.
import { AtomicI32Array } from "nish/threads"
import { copy } from "./use"

export const main = (): i32 => {
  return copy(new AtomicI32Array(4), [1, 2, 3], parseInt("-5"))
}
