// A `null` stored through a guard as the whole value of a `Mutex<string | null>`.
import { Mutex } from "nish/threads"

export function main(): i32 {
  const m = new Mutex<string | null>("start")
  {
    using g = m.lock()
    g.value = null
  }
  return 0
}
