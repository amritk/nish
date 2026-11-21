// A slot guard that a later change undoes proves nothing (docs/LANGUAGE.md,
// "Panic sites"). The loop guards `i < dst.length` as `spawn_slot_proven`
// does, then `dst` loses an element before the spawn, so the guard no longer
// holds at the call. The destination rules refuse the `pop`, a use of a
// destination before the scope joins, so no `spawn-slot` site is left for the
// stale guard to prove. `parallel_length_guard_then_mutate` is the same for
// `parallelMapInto`.
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
