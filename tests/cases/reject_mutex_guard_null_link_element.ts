// A `null` stored through a guard into an element of a `(Link | null)[]`: only
// a `string | null` slot takes a `null`, so an element that holds an object
// is refused like a field.
import { Mutex } from "nish/threads"

class Link {
  n: i32 = 0
  next: Link | null = null
}

class Links {
  items: (Link | null)[]
  constructor() {
    this.items = [null, null]
  }
}

export function main(): i32 {
  const m = new Mutex<Links>(new Links())
  {
    using g = m.lock()
    g.value.items[1] = null
  }
  return 0
}
