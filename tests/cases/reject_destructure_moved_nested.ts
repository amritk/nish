// R5-1: a pattern over `o.a.items` holds its element where the twin
// `const p = o.a.items[0]` does, so a push that may move the storage refuses it the same way.
interface P {
  x: i32
}
class A {
  items: P[]
  constructor() {
    this.items = []
  }
}
class O {
  items: P[]
  a: A
  constructor() {
    this.items = []
    this.a = new A()
  }
}
const mk = (x: i32): P => ({ x })
const getItems = (o: O): P[] => o.items
const readX = (p: P): i32 => p.x
export const main = (): void => {
  const o = new O()
  o.items.push(mk(1))
  o.a.items.push(mk(1))
  const [p] = o.a.items
  for (let i = 0; i < 1000; i++) {
    o.items.push(mk(5))
    o.a.items.push(mk(5))
  }
  console.log(readX(p))
}
