// WP48 stage 2a: a compact class's links are 32-bit offsets, and the program
// prints what it prints without the marker.
import { Compact } from "nish:compact"

class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
}

class Tree implements Compact {
  left: Tree | null = null
  right: Tree | null = null
  depth: i32
  constructor(depth: i32) {
    this.depth = depth
    if (depth > 0) {
      this.left = new Tree(depth - 1)
      this.right = new Tree(depth - 1)
    }
  }
}

// A plain class holding a compact link stores it as 32 bits too.
class Holder {
  name: string
  head: Cell | null = null
  constructor(name: string) {
    this.name = name
  }
}

const count = (t: Tree | null): i32 => {
  if (t === null) {
    return 0
  }
  return 1 + count(t.left) + count(t.right)
}

export const main = (): i32 => {
  let head: Cell | null = null
  for (let i = 0; i < 5; i++) {
    head = new Cell(i, head)
  }
  let sum = 0
  let c = head
  while (c !== null) {
    sum += c.value
    c = c.next
  }
  console.log(sum)
  const h = new Holder("list")
  h.head = head
  const first = h.head
  if (first !== null) {
    const second = first.next
    if (second !== null) {
      second.value += 10
      console.log(second.value)
    }
  }
  const cells: Cell[] = []
  c = head
  while (c !== null) {
    cells.push(c)
    c = c.next
  }
  console.log(cells.length)
  cells[4].next = cells[0]
  const back = cells[4].next
  console.log(back !== null ? back.value : -1)
  console.log(count(new Tree(10)))
  return 0
}
