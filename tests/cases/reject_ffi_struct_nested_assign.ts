// WP27 S4.1: An embedded struct is part of its owner: it is written field by field, not replaced.
declare class Inner {
  n: i64
}

declare class Outer {
  inner: Inner
}

export const main = (): number => {
  const o = new Outer()
  o.inner = new Inner()
  return 0
}
