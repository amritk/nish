// A class field typed as a union, in a module a page loads: an `--emit-dts`
// build accepts it (the `.d.ts` names only the exports), and the same build
// with `--emit-header` refuses it, since a C header has no spelling for a
// union field (tests/run.js, persist).

enum Kind {
  Dot,
  Box,
}
interface Dot {
  readonly kind: Kind.Dot
  x: i32
}
interface Box {
  readonly kind: Kind.Box
  side: i32
}
class Shape {
  m: Dot | Box
  constructor(m: Dot | Box) {
    this.m = m
  }
}
const sizeOf = (m: Dot | Box): i32 => (m.kind === Kind.Dot ? m.x : m.side)
export const area = (side: i32): i32 => {
  const b: Box = { kind: Kind.Box, side: side }
  return sizeOf(new Shape(b).m)
}
