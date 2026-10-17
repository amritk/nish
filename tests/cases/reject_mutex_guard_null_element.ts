// A `null` stored through a guard into an element of a `(string | null)[]`.
import { Mutex } from "nish/threads"

class Slots {
  names: (string | null)[]
  constructor() {
    this.names = [null, null]
  }
}

export function main(): i32 {
  const m = new Mutex<Slots>(new Slots())
  {
    using g = m.lock()
    g.value.names[1] = null
  }
  return 0
}
