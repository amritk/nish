// A `null` stored through a guard as the whole value of a `Mutex<Link | null>`.
import { Mutex } from "nish/threads"

class Link {
  n: i32 = 0
  next: Link | null = null
}

export function main(): i32 {
  const m = new Mutex<Link | null>(new Link())
  {
    using g = m.lock()
    g.value = null
  }
  return 0
}
