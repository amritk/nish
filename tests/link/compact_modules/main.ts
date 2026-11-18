// WP48: a module that imports a compact class reads and writes its links
// as the declaring module lays them out, and a class of its own that holds
// one stores it as an offset too.
import { Cell, build } from "./cell"

class Queue {
  first: Cell | null = null
  size: i32 = 0
}

const values = (c: Cell | null): string[] => {
  const out: string[] = []
  let at = c
  while (at !== null) {
    out.push(`${at.value}`)
    at = at.next
  }
  return out
}

export const main = (): i32 => {
  const q = new Queue()
  q.first = build(4)
  q.size = 4
  const head = q.first
  if (head !== null) {
    head.value *= 10
    head.next = new Cell(7, head.next)
    q.size += 1
  }
  console.log(values(q.first).join(","))
  console.log(q.size)
  const seen = new Map<Cell, i32>()
  let at = q.first
  while (at !== null) {
    seen.set(at, at.value)
    at = at.next
  }
  console.log(seen.size)
  return 0
}
