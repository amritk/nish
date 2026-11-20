// WP48: `--emit-napi-async` refuses like `--emit-napi`: the export at its signature (a method of an exported class too), the class no export names at its name.
import { Compact } from "nish:compact"

export class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
  prepend(value: i32): Cell {
    return new Cell(value, this)
  }
}

class Leaf implements Compact {
  weight: i32
  constructor(weight: i32) {
    this.weight = weight
  }
}

export const push = (value: i32, head: Cell | null): Cell => new Cell(value, head)

export const weigh = (n: i32): i32 => new Leaf(n).weight

export const main = (): number => push(weigh(3), null).value
