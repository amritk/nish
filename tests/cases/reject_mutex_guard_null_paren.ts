// A `null` in parentheses stored through a guard, `g.value.last = (null)`: the
// parentheses do not hide the `null`, so the store is refused with the same
// message as the bare `null`, not as an object store.
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
    g.value.last = (null)
  }
  return 0
}
