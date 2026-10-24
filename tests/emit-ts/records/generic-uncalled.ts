// A generic nothing calls has no native body and no types. A body no type
// changes is written as it is: `xs[0]` still goes through `idx`, the rewrite
// that needs no type, and `push` copies nothing, because no record of this
// program is held inline. A body some type would change is written to throw:
// `wide`'s `i64` is a `bigint`, `xs.length - 1` wraps at a width no instance
// says, `s.length` counts UTF-8 bytes only where `s` is known to be a string,
// and `Counter`'s constructor adds at a width no instance says.
const first = <T>(xs: T[]): T => {
  return xs[0]
}

const wide = <T>(xs: T[]): i64 => {
  return toI64(xs.length) + 1
}

const put = <T>(xs: T[], v: T): void => {
  xs.push(v)
}

const size = <T>(s: string, x: T): i32 => {
  return s.length
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
    this.n = n + 1
  }
}

class Bag {
  n: i32
  constructor() {
    this.n = 3
  }
  pick<T>(xs: T[]): T {
    return xs[this.n - 1]
  }
}

export const main = (): number => {
  const b = new Bag()
  console.log(`${b.n}`)
  return 0
}
