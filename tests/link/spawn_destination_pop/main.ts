// A destination of a task may not be read before its scope joins
// (docs/LANGUAGE.md). The loop guards `i < dst.length`, then calls `dst.pop()`
// before the spawn: the destination rules refuse the `pop`, a use of `dst`
// before the scope joins. This tests those rules, not the slot proof;
// `spawn_slot_guard_then_mutate` tests the slot proof.
import { scope } from "nish/threads"

const low = (x: i32): i32 => x & 255

export const main = (): i32 => {
  const dst: i32[] = new Array<i32>(4)
  {
    using s = scope()
    for (let i = 0; i < dst.length; i++) {
      dst.pop()
      s.spawn(low, i, dst, i)
    }
  }
  return 0
}
