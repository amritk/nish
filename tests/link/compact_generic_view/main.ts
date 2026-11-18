// WP48 stage 2a: a link held by a generic class's instantiation, by an
// instance of a generic interface, and by a class in another module is a
// 32-bit offset like a compact class's own.
import { Cell } from "./cell"
import { S, slot } from "./iface"
interface Holder<T> { value: T }
interface Plain { head: Cell; tag: i32 }
class H implements Holder<Cell> {
  value: Cell
  constructor(v: Cell) { this.value = v }
}
class P implements Plain {
  head: Cell
  tag: i32 = 5
  constructor(c: Cell) { this.head = c }
}
interface Container<T> { inner: T; count: i32 }
class Box<T> implements Container<T> {
  inner: T
  count: i32 = 3
  constructor(v: T) { this.inner = v }
}
const get = (h: Holder<Cell>): Cell => h.value
const plain = (p: Plain): i32 => p.head.n + p.tag
const cont = (c: Container<Cell>): i32 => c.inner.n + c.count
export const main = (): i32 => {
  const c = new Cell(41)
  c.next = new Cell(1)
  console.log(get(new H(c)).n)
  console.log(plain(new P(c)))
  const s = new S()
  console.log(slot(s))
  s.item = c.next
  console.log(slot(s))
  console.log(cont(new Box<Cell>(c)))
  return 0
}
