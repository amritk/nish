// A caller contract kept in a field: `Stage` holds `cell` and calls it
// through `this.op`, a call that names no function, so `cell`'s guard
// sees no caller's test there. `main`'s direct call `cell(xs, 2)` is
// proven, yet `cell`'s `panic` stays its own: proven: false.
import { done } from "./done"

type Op = (xs: i32[], at: i32) => i32

const cell = (xs: i32[], at: i32): i32 => {
  if (at < 0 || at >= toI32(xs.length)) {
    panic("cell: the index is outside the array")
  }
  return at
}

class Stage {
  op: Op
  constructor(op: Op) {
    this.op = op
  }
  run(xs: i32[], at: i32): i32 {
    return this.op(xs, at)
  }
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3]
  const s = new Stage(cell)
  console.log(`${cell(xs, 2)} ${s.run(xs, 1)}`)
  console.log(done())
  return 0
}
