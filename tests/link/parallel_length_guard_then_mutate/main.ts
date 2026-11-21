// A length guard that a later change undoes proves nothing (docs/LANGUAGE.md,
// "Panic sites"). Each call below is guarded as `parallel_length_proven`
// guards its own, then an array or a binding changes before the call: `src`
// grows by a push, and `dst` is bound to a shorter array. The lengths the guard
// proved are forgotten at each change, so both `parallel-length` sites stay
// unproven and `--deny-panics` (`args`) refuses each. `spawn_slot_guard_then_mutate`
// is the same for a `spawn` slot.
import { parallelMapInto } from "nish/threads"

const low = (x: i32): i32 => x & 255

const grown = (src: i32[], dst: i32[]): void => {
  if (dst.length < src.length) {
    return
  }
  src.push(1)
  parallelMapInto(src, dst, low)
}

const rebound = (src: i32[], out: i32[]): void => {
  let dst = out
  if (dst.length < src.length) {
    return
  }
  dst = [0]
  parallelMapInto(src, dst, low)
}

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3]
  const dst: i32[] = [0, 0, 0, 0]
  grown(src, dst)
  rebound(src, dst)
  return 0
}
