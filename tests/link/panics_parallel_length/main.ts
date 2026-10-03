// Panic sites (docs/LANGUAGE.md): `parallelMapInto` checks that `dst` is at
// least as long as `src` before it divides the work, and panics with
// `std/threads.ts`'s message when it is not, so every call is a
// `parallel-length` site of its caller. `std/threads.ts`'s own functions are
// listed too, the check among them as the `panic` the call reaches.
import { parallelMapInto } from "nish/threads"

const double = (x: i32): i32 => x * 2

const doubleAll = (src: i32[], dst: i32[]): void => {
  parallelMapInto(src, dst, double)
}

export const main = (): i32 => {
  const src: i32[] = [1, 2, 3]
  const dst: i32[] = [0, 0, 0]
  doubleAll(src, dst)
  console.log(`${dst[0] + dst[1] + dst[2]}`)
  return 0
}
