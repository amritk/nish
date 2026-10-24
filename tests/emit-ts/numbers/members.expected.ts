// A compound assignment to a field of an element at a computed index: written
// `x = x op e`, its target is repeated with the index as rewritten, which is
// safe because the index holds only names, literals and their arithmetic.
import { idiv } from "nish/runtime"
import type { u8, i32 } from "nish/runtime"
class Point {
  n: u8 = 250
  total: i32 = 7
}

export const main = (): number => {
  const pts: Point[] = [new Point(), new Point()]
  const i: i32 = 0
  pts[((i + 1) | 0)].n = ((pts[((i + 1) | 0)].n + 10) & 0xff)
  pts[((i + 1) | 0)].total = idiv(pts[((i + 1) | 0)].total, 2)
  pts[0].n = ((pts[0].n - 251) & 0xff)
  console.log(`${pts[0].n} ${pts[1].n} ${pts[1].total}`)
  return 0
}
