// The class, interface and enum forms, several to a declaration: each
// declaration reports the first form in source order, and nothing else.
class Header {
  static "x": i32 = 1
}
class Signature {
  static m(): void
}
class Body {
  m(): void
  "n"(): void {}
}
class Constructor {
  constructor(public x: i32): void
}
abstract class Base {
  abstract m(): void
}
class Member {
  static abstract m(): void
}
class Table {
  [k: string]: i32
  static {}
}
interface Shape extends Header {
  new (): Shape
}
const literal = { m(): i32 { return 1 }, "a": 1 }
declare enum Kind { A }
export default class {
  static {}
}
