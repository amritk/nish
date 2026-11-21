// WP48 rule 2: a `declare class` holds no object of a compact class.
import { Compact } from "nish:compact"

class Cell implements Compact {
  value: i32 = 0
  next: Cell | null = null
}

declare class Holder {
  cell: Cell | null
}

export const main = (): number => {
  const h = new Holder()
  return h.cell === null ? 0 : 1
}
