// WP48: a compact object that never outlives its function is still allocated
// through `@nish_alloc_ref`, never an `alloca`: its offset is counted from the
// reserved range, which a stack slot is not in.
import { Compact } from "nish:compact"

class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
}

const pairSum = (a: i32, b: i32): i32 => {
  const cell = new Cell(a, new Cell(b, null))
  const next = cell.next
  return next === null ? cell.value : cell.value + next.value
}

export const main = (): i32 => {
  console.log(`${pairSum(3, 4)}`)
  return 0
};
