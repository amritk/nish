// A `spawn` slot the caller proves (docs/LANGUAGE.md, "Panic sites"). A
// four-argument `s.spawn(entry, arg, dst, at)` checks that `at` is a slot of
// `dst` before it takes the task, so the call is a `spawn-slot` site of its
// caller, judged as `dst[at]` would be: here the loop `i < dst.length` from 0
// proves it, the site is listed as proven, and the call no longer reaches the
// check inside `std/threads.ts`. `--deny-panics` (`args`) holds this package
// to no panic, and it builds. `spawn_slot_unproven` is the slot unguarded.
import { scope } from "nish/threads"

const low = (x: i32): i32 => x & 255

export const main = (): i32 => {
  const dst: i32[] = new Array<i32>(4)
  {
    using s = scope()
    for (let i = 0; i < dst.length; i++) {
      s.spawn(low, i, dst, i)
    }
  }
  for (let i = 0; i < dst.length; i++) {
    console.log(dst[i])
  }
  return 0
}
