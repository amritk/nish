// A `null` in parentheses stored through a guard into a `Link | null` field,
// `g.value.next = (null)`: the parentheses do not hide the `null`, so the
// store is refused with the same message as the bare `null`.
import { Mutex } from "nish/threads"

class Link {
  n: i32 = 0
  next: Link | null = null
}

export function main(): i32 {
  const m = new Mutex<Link>(new Link())
  {
    using g = m.lock()
    g.value.next = (null)
  }
  return 0
}
