// WP48 stage 2a: a value holding a link is copied whole -- an inline record
// into an array slot, an object spread -- and the link it carries still names
// the instance it named, so walking it prints the same list.
import { Compact } from "nish:compact"

class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
}

// No class implements `Rec`, so a `Rec[]` holds its records inline and a
// push copies the record's bytes, link and all.
interface Rec {
  head: Cell | null
  tag: i32
}

const sum = (head: Cell | null): i32 => {
  let total = 0
  let at = head
  while (at !== null) {
    total = total + at.value
    at = at.next
  }
  return total
}

const build = (n: i32): Cell | null => {
  let head: Cell | null = null
  for (let i = 1; i <= n; i++) {
    head = new Cell(i, head)
  }
  return head
}

export const main = (): i32 => {
  const recs: Rec[] = []
  for (let i = 1; i <= 4; i++) {
    const r: Rec = { head: build(i * 3), tag: i }
    recs.push(r)
  }
  for (const r of recs) {
    console.log(`${r.tag}: ${sum(r.head)}`)
  }

  // A spread copies `head` from one record into a new one.
  const first = recs[0]
  const copy: Rec = { ...first, tag: 9 }
  console.log(`${copy.tag}: ${sum(copy.head)}`)
  // The copy and the original name the same cells.
  const shared = first.head
  if (shared !== null) {
    shared.value = 100
    console.log(`${sum(copy.head)}`)
  }
  const swapped: Rec[] = [recs[3], recs[1]]
  console.log(`${sum(swapped[0].head)} ${sum(swapped[1].head)}`)
  return 0
}
