// A `spawn` slot nothing proves (docs/LANGUAGE.md, "Panic sites"). `at` comes
// from a parameter with no guard, so the `spawn-slot` site of this call stays
// unproven, and `--deny-panics` (`args`), which holds this package to no panic,
// refuses it with the guard that would prove it. `spawn_slot_proven` is the
// same call inside a loop below `dst.length`.
import { scope } from "nish/threads"

const low = (x: i32): i32 => x & 255

const fill = (at: i32): i32 => {
  const dst: i32[] = new Array<i32>(4)
  {
    using s = scope()
    s.spawn(low, at, dst, at)
  }
  return 0
}

export const main = (): i32 => fill(3)
