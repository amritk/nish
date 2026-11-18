// A compact link on a Mach-O target: the offset is taken against
// `@nish_ref_base`, which the runtime sets, rather than against zero.
import { Compact } from "nish:compact"

class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
}

export const main = (): i32 => {
  const cell = new Cell(2, new Cell(1, null))
  const next = cell.next
  return next === null ? cell.value : cell.value + next.value
};
