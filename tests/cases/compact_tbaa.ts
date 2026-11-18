// WP48 stage 2b: a compact link's load and store carry a TBAA tag of their
// own, `ref32`, beside `i32` and `ptr`. Two tags that name a class decide
// alias by the class path alone, so the scalar shows only where LLVM merges
// two link stores through different classes into one: `simplifycfg` sinks
// `p.next = c` and `q.next = c` into one store whose tag is the bare `ref32`
// scalar. That store is not read as a clobber of `h.count` (an `i32`) or
// `h.held` (a `ptr`), so `gvn` forwards each first store to the return.
// tests/run.js ("compact tbaa") renames the node to `i32` and to `ptr` and
// checks each rename keeps its reload.
import { Compact } from "nish:compact"

class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
}

class Node implements Compact {
  key: i32
  next: Cell | null
  constructor(key: i32, next: Cell | null) {
    this.key = key
    this.next = next
  }
}

class Tag {
  id: i32
  constructor(id: i32) {
    this.id = id
  }
}

class Holder {
  count: i32
  held: Tag
  constructor(count: i32, held: Tag) {
    this.count = count
    this.held = held
  }
}

export const relinkCount = (k: boolean, p: Cell, q: Node, c: Cell, h: Holder): i32 => {
  h.count = 1
  if (k) {
    p.next = c
  } else {
    q.next = c
  }
  return h.count
}

export const relinkHeld = (k: boolean, p: Cell, q: Node, c: Cell, h: Holder, t: Tag): Tag => {
  h.held = t
  if (k) {
    p.next = c
  } else {
    q.next = c
  }
  return h.held
}

export const main = (): i32 => {
  const c = new Cell(3, null)
  const p = new Cell(2, null)
  const q = new Node(1, null)
  const h = new Holder(0, new Tag(5))
  console.log(relinkCount(true, p, q, c, h))
  console.log(relinkHeld(false, p, q, c, h, new Tag(7)).id)
  const pn = p.next
  const qn = q.next
  console.log(pn !== null ? pn.value : -1)
  console.log(qn !== null ? qn.value : -1)
  // The same object on both sides of a link store: its i32 field is disjoint bytes.
  p.value = 4
  p.next = p
  console.log(p.value)
  return 0
}
