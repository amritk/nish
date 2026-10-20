// NL2537: a `null` stored through a guard into a slot that holds an object: a
// guard stores no pointer, and a `null` only into a `string | null` slot.
import { Mutex } from "nish/threads"

class Link {
  n: i32 = 0
  next: Link | null = null
}

export function main(): i32 {
  const m = new Mutex<Link>(new Link())
  {
    using g = m.lock()
    g.value.next = null
  }
  return 0
}
