// A generic nothing calls has no native body and no types, and is written as
// it is: `xs[k]` still goes through `idx`, the rewrite that needs no type, and
// the arithmetic stays as written, since no instance says its width. `push`
// copies nothing here, because no record of this program is held inline.
// `wide` would need its types, an `i64` being a `bigint` and `toI64` a builtin
// the checker resolves, so its body is written to throw.
import { idx } from "nish/runtime"
import type { i64, i32 } from "nish/runtime"
const last = <T>(xs: T[]): T => {
  const k = xs.length - 1
  return idx(xs, k)
}

const wide = <T>(xs: T[]): i64 => {
    throw new Error("--emit-ts: a generic no instance reaches")
  }

const put = <T>(xs: T[], v: T): void => {
  xs.push(v)
}

class Box<T> {
  item: T
  constructor(item: T) {
    this.item = item
  }
  both(): T[] {
    return [this.item, this.item]
  }
}

class Bag {
  n: i32
  constructor() {
    this.n = 3
  }
  pick<T>(xs: T[]): T {
    return idx(xs, this.n - 1)
  }
}

export const main = (): number => {
  const b = new Bag()
  console.log(`${b.n}`)
  return 0
}
