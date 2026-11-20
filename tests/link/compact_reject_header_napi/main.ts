// WP48 rule 1: `--emit-napi` beside `--emit-header` still refuses: the header is fine, the addon is not.
import { Compact } from "nish:compact"

class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
}

const sum = (head: Cell | null): i32 => {
  let total: i32 = 0
  let at = head
  while (at !== null) {
    total = total + at.value
    at = at.next
  }
  return total
}

export const total = (n: i32): i32 => {
  let head: Cell | null = null
  for (let i: i32 = 0; i < n; i++) {
    head = new Cell(i, head)
  }
  return sum(head)
}

export const main = (): number => total(4)
