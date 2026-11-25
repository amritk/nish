// A `store` whose second argument moves its index: `(i = k)` runs before the
// method checks the `i` it was passed, so that check says nothing of the new
// `i`. Nothing proves `x[i]`'s lower end, so the read in `use.ts`, which
// `noPanic` lists, stays unproven and is refused. Recording the `store`'s
// check past an argument that assigns would prove it, and `k = -5` would read
// `x[-5]`.
import { AtomicI32Array } from "nish/threads"
import { move } from "./use"

export const main = (): i32 => {
  return move(new AtomicI32Array(4), [1, 2, 3], 1, parseInt("-5"))
}
