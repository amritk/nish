// WP48 rule 4: an export whose signature holds a compact class is refused at the signature.
import { Compact } from "nish:compact"

export class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
}

export const push = (value: i32, head: Cell | null): Cell => new Cell(value, head)

export const main = (): number => push(3, null).value
