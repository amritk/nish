// NL2303: a generic method's type argument is not written at the call either,
// and the fix deletes it, through a path of fields as well.
class Holder {
  value: i32 = 0

  get<T>(x: T): T {
    return x
  }
}
class Outer {
  h: Holder

  constructor() {
    this.h = new Holder()
  }

  read(n: i32): i32 {
    return this.h.get<i32>(n)
  }
}
export const test = (): number => {
  const h = new Holder()
  const o = new Outer()
  const b: boolean = true
  const seven = h.get<i32>(7)
  const yes = h.get<boolean>(b)
  return seven + o.read(1) + (yes ? 1 : 0)
}
