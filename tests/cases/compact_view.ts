// WP48 stage 2a: an interface a compact class implements may name that
// class's 4-aligned block, so a parameter of that interface promises align 4.
import { Compact } from "nish:compact"

interface Node { value: i32 }

class Cell implements Compact, Node {
  value: i32
  next: Cell | null = null
  constructor(value: i32) {
    this.value = value
  }
}

const read = (n: Node): i32 => n.value

export const main = (): i32 => {
  const a = new Cell(4)
  a.next = new Cell(5)
  const b = a.next
  console.log(read(a) + (b === null ? 0 : read(b)))
  return 0
}
