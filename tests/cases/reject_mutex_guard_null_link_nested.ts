// A `null` stored through a guard into a `Link | null` field of an object the
// data reaches, `g.value.inner.next = null`: the rule reads the type of the
// slot stored into, however deep the access.
import { Mutex } from "nish/threads"

class Link {
  n: i32 = 0
  next: Link | null = null
}

class Holder {
  inner: Link
  constructor() {
    this.inner = new Link()
  }
}

export function main(): i32 {
  const m = new Mutex<Holder>(new Holder())
  {
    using g = m.lock()
    g.value.inner.next = null
  }
  return 0
}
