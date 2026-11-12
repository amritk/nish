// WP27 S4.1: An embedded struct cannot be held as a value: it lives inside its owner.
declare class Inner {
  n: i64
}

declare class Outer {
  inner: Inner
}

export const main = (): number => {
  const o = new Outer()
  const inner = o.inner
  return toI32(inner.n)
}
