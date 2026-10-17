// NL2523: a `null` stored through a guard: the store copies a string into
// memory the `Mutex` owns, and a `null` takes no part in that exchange.
import { Mutex } from "nish/threads"

class Slots {
  last: string | null
  constructor() {
    this.last = "start"
  }
}

export function main(): i32 {
  const m = new Mutex<Slots>(new Slots())
  {
    using g = m.lock()
    g.value.last = null
  }
  return 0
}
