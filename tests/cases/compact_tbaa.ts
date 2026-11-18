// WP48 stage 2b: a compact link's load and store carry a TBAA tag of their
// own, `ref32`, beside `i32`, so a link store through one object is not read
// as a clobber of an `i32` field of another: after `b.next = c`, `a.value`
// is still the 1 just stored, and `opt -O2` folds the reload away.
import { Compact } from "nish:compact"

class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
}

export const relink = (a: Cell, b: Cell, c: Cell): i32 => {
  a.value = 1
  b.next = c
  return a.value
}

export const main = (): i32 => {
  const c = new Cell(3, null)
  const b = new Cell(2, null)
  const a = new Cell(0, b)
  console.log(relink(a, b, c))
  // The same object on both sides: the field and the link are disjoint bytes.
  console.log(relink(b, b, c))
  const next = b.next
  console.log(next !== null ? next.value : -1)
  return 0
}
