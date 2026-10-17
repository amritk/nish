// A `null` stored through a guard into a `Link | null` field: the slot holds
// a pointer, which a guard stores in no form, so it is refused with the same
// message as a `string | null` slot, whose advice names both kinds of slot.
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
