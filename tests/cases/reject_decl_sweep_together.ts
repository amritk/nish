// The declaration forms the checker refuses are a pass 1 sweep, which recovers
// per declaration: each declaration that holds one reports it once and
// nothing else, the first in source order. `Box` reports its default type
// argument, `Keyed` its `keyof` though nothing instantiates it, and `first`
// its default rather than the `keyof` after it, although the parser keeps a
// declaration's type parameters as its last child. `tests/run.js` pins the
// three through `--json`.
interface Point {
  x: i32
}

export class Box<T = i32> {
  value: i32 = 0
}

export interface Keyed<T> {
  key: keyof T
}

export const first = <T = Point>(k: keyof Point): i32 => 0
