// A generic nothing calls has no native body and no types, so a body is
// written as it is only where no row asks for a type: `both`'s array literal
// copies nothing, because no record of this program is held inline. Every
// other body asks for one and is written to throw: whether `xs` in `xs[0]` and
// `xs.push(v)` is a string, whether `item` and `n` are 64-bit, `wide`'s `i64`,
// which is a `bigint`, `s.length`, which counts UTF-8 bytes only where `s` is
// known to be a string, and `Tally`'s `0`, a `bigint` beside its `u64` field,
// in the initializer and the compare. `drain`'s `p.pop()` is `Pile`'s own,
// which without a bound call reads as an array's `pop`.
import { idx } from "nish/runtime"
import type { i64, i32, u64 } from "nish/runtime"
const first = <T>(xs: T[]): T => {
    throw new Error("--emit-ts: a generic no instance reaches")
  }

const wide = <T>(xs: T[]): i64 => {
    throw new Error("--emit-ts: a generic no instance reaches")
  }

const put = <T>(xs: T[], v: T): void => {
    throw new Error("--emit-ts: a generic no instance reaches")
  }

const size = <T>(s: string, x: T): i32 => {
    throw new Error("--emit-ts: a generic no instance reaches")
  }

class Box<T> {
  item: T
  constructor(item: T) {
    throw new Error("--emit-ts: a generic no instance reaches")
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

class Tally<T> {
  n: u64 = (() => {
    throw new Error("--emit-ts: a generic no instance reaches")
  })()
  empty(): boolean {
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

class Pile {
  top: i32
  constructor() {
    this.top = 0
  }
  pop(): i32 {
    return this.top
  }
}

const drain = <T>(p: Pile, x: T): i32 => {
    throw new Error("--emit-ts: a generic no instance reaches")
  }

export const main = (): number => {
  const b = new Bag()
  console.log(`${b.n}`)
  return 0
}
