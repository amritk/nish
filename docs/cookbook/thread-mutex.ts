import { Mutex } from "nish/threads"

class Tally {
  n: i32 = 0
}

export const bump = (m: Mutex<Tally>, k: i32): i32 => {
  using g = m.lock()
  g.value.n = g.value.n + k
  return g.value.n
}
