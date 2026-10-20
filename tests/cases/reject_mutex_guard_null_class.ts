// A `null` stored through a guard into a `Link | null` field: the slot holds
// a pointer, which a guard stores in no form, `null` included. Only a
// `string | null` slot takes a `null` (`thread_mutex_null_store`).
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
