// WP48: `--emit-header` beside `--emit-napi-async` lifts neither refusal: the header is fine, the addon is not.
import { Compact } from "nish:compact"

export class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
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
