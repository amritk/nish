// WP27 S4.1: An embedded struct is passed only to a `declare function`, which borrows it for the call.
declare class Inner {
  n: i64
}

declare class Outer {
  inner: Inner
}

const read = (inner: Inner): i64 => inner.n

export const main = (): number => {
  const o = new Outer()
  return toI32(read(o.inner))
}
