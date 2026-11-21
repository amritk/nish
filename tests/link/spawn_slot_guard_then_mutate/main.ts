// A slot guard that a later change undoes proves nothing (docs/LANGUAGE.md,
// "Panic sites"). The loop guards `i < dst.length` as `spawn_slot_proven`
// does and copies `i` to `k`, then `k` moves past the guard before the spawn
// without `dst` being read. The guard no longer covers `k`, so the
// `spawn-slot` site stays unproven and `--deny-panics` (`args`) refuses it.
// Spawning `k` without the `k = k + 1` builds.
import { scope } from "nish/threads"

const low = (x: i32): i32 => x & 255

export const main = (): i32 => {
  const dst: i32[] = new Array<i32>(4)
  {
    using s = scope()
    for (let i = 0; i < dst.length; i++) {
      let k = i
      k = k + 1
      s.spawn(low, k, dst, k)
    }
  }
  return 0
}
