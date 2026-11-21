// A `parallelMapInto` length check nothing proves (docs/LANGUAGE.md, "Panic
// sites"). `src` and `dst` are parameters with no guard, so the
// `parallel-length` site of this call stays unproven, and `--deny-panics`
// (`args`), which holds this package to no panic, refuses it with the guard
// that would prove it. `parallel_length_proven` is the same call guarded.
import { parallelMapInto } from "nish/threads"

const low = (x: i32): i32 => x & 255

const fill = (src: i32[], dst: i32[]): void => {
  parallelMapInto(src, dst, low)
}

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3]
  const dst: i32[] = [0, 0, 0]
  fill(src, dst)
  return 0
}
