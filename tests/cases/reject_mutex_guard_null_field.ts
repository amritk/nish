// A `null` stored through a guard into a `string | null` field: the store
// would leave the copy the slot held allocated, so it is refused, and the
// message says to store `""` instead.
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
