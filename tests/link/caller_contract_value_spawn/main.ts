// A caller contract as a spawn entry: `s.spawn(half, 4, out, 0)` runs
// `half(4)` on a thread, through a call that names no function, so `half`'s
// guard sees no caller's test there. `main`'s direct call `half(6)` is
// proven, yet `half`'s `panic` stays its own: proven: false.
import { scope } from "nish/threads"

const half = (x: i32): i32 => {
  if (x < 0) {
    panic("half: negative")
  }
  return x / 2
}

export const main = (): i32 => {
  const out: i32[] = [0]
  {
    using s = scope()
    if (out.length > 0) {
      s.spawn(half, 4, out, 0)
    }
  }
  if (out.length > 0) {
    console.log(`${half(6)} ${out[0]}`)
  }
  return 0
}
