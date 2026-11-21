// WP48: a generic class cannot implement `Compact` yet, since its
// instantiations keep full-pointer links.
import { Compact } from "nish:compact"

class Gen<T> implements Compact {
  val: T
  next: Gen<T> | null = null
  constructor(val: T) {
    this.val = val
  }
}

export const main = (): i32 => {
  const g = new Gen<i32>(1)
  return g.val - 1
}
