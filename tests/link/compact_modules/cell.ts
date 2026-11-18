// The compact class lives in one module and is linked through in another.
import { Compact } from "nish:compact"

export class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
}

export const build = (n: i32): Cell | null => {
  let head: Cell | null = null
  for (let i = 1; i <= n; i++) {
    head = new Cell(i, head)
  }
  return head
}
