// A generic nothing calls has no native body and no types. A body no type
// changes is written as it is: `xs[0]` still goes through `idx`, the rewrite
// that needs no type, and `push` copies nothing, because no record of this
// program is held inline. A body some type would change is written to throw:
// `wide`'s `i64` is a `bigint`, `xs.length - 1` wraps at a width no instance
// says, `s.length` counts UTF-8 bytes only where `s` is known to be a string,
// and `Counter`'s constructor adds at a width no instance says.
import { idx } from "nish/runtime"
import type { i64, i32 } from "nish/runtime"
const first = <T>(xs: T[]): T => {
  return idx(xs, 0)
}

const wide = <T>(xs: T[]): i64 => {
    throw new Error("--emit-ts: a generic no instance reaches")
  }

const put = <T>(xs: T[], v: T): void => {
  xs.push(v)
}

const size = <T>(s: string, x: T): i32 => {
    throw new Error("--emit-ts: a generic no instance reaches")
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

class Counter<T> {
  n: i32
  constructor(n: i32) {
    throw new Error("--emit-ts: a generic no instance reaches")
  }
}

class Bag {
  n: i32
  constructor() {
    this.n = 3
  }
  pick<T>(xs: T[]): T {
    throw new Error("--emit-ts: a generic no instance reaches")
  }
}

export const main = (): number => {
  const b = new Bag()
  console.log(`${b.n}`)
  return 0
}
