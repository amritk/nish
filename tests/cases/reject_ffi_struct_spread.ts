// WP27 S4.1: A spread reads each field as a class holds it, and a nested layout is held inline.
declare class Inner {
  v: i32
}

declare class Outer {
  a: i32
  inner: Inner
}

class Plain {
  a: i32
  inner: Inner
  constructor(a: i32, inner: Inner) {
    this.a = a
    this.inner = inner
  }
}

export const main = (): number => {
  const o = new Outer()
  const p: Plain = { ...o }
  return p.a
}
