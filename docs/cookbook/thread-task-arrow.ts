import { Mutex, scope } from "nish/threads"

class Tally {
  total: i32 = 0
}

const addTo = (tally: Mutex<Tally>, n: i32): void => {
  using g = tally.lock()
  g.value.total = g.value.total + n
}

export const tallied = (a: i32, b: i32): i32 => {
  const tally = new Mutex<Tally>(new Tally())
  {
    using s = scope()
    s.spawn(() => addTo(tally, a))
    s.spawn(() => addTo(tally, b))
  }
  using g = tally.lock()
  return g.value.total
}
