// WP48 rule 2: a `declare class` is a C struct and cannot implement `Compact`.
import { Compact } from "nish:compact"

declare class Clock implements Compact {
  t: i64
}

export const main = (): number => {
  const c = new Clock()
  return Number(c.t)
}
