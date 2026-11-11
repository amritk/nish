// WP51 stage 1, §2.3 store row "a field of an interface type": a store
// through `Named.f` reaches the class field it names, and a store to the
// class field reaches a read through the interface, both ways; so `u3`,
// stored once through each, is in both sets beside `u1`, and `u2`, called
// through a local of its own, stays out of them.
type F = (x: i32) => i32

const u1 = (x: i32): i32 => x + 1
const u2 = (x: i32): i32 => x * 2
const u3 = (x: i32): i32 => x + 3

interface Named {
  f: F
}

class Tool implements Named {
  f: F
  constructor(f: F) {
    this.f = f
  }
}

const storeThrough = (n: Named): void => {
  n.f = u3
}

const callThrough = (n: Named): i32 => n.f(10)

export const main = (): void => {
  const other: F = u2
  const t = new Tool(u1)
  const before = t.f(10)
  storeThrough(t)
  const after = t.f(10)
  const back = new Tool(u1)
  back.f = u3
  console.log(`${before} ${after} ${callThrough(back)} ${other(10)}`)
}
