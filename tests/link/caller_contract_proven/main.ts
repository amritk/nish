// A caller contract the callers prove (docs/LANGUAGE.md, "Panic sites").
// `sum` and `Span.width` start with `if (test) { panic(m) }` on comparisons of
// their own parameters, so each call into either is a `contract` site of its
// caller, proven where the caller's arguments make every comparison false: a
// literal range of a buffer `knownMinLength` bounds, the whole buffer, a range
// behind its test, and a method's offset behind `at >= 0`. Neither is exported,
// so every route into them is one of these calls, and their own `panic`s are
// listed as proven (`expected.panics`). `caller_contract_unproven` is a call
// nothing proves. `done.ts` is only the cross-module call every linked case
// makes.
import { done } from "./done"

class Span {
  base: i32
  constructor(base: i32) {
    this.base = base
  }
  width(at: i32): i32 {
    if (at < 0) {
      panic("Span.width: a negative offset")
    }
    return at < this.base ? 0 : at
  }
}

const sum = (xs: i32[], start: i32, end: i32): i32 => {
  if (start < 0 || end < start || end > toI32(xs.length)) {
    panic("sum: the range is outside the array")
  }
  let total = 0
  for (let i = start; i < end; i++) {
    total = wrap(total, xs[i])
  }
  return total
}

const wrap = (a: i32, b: i32): i32 => (a > 1000 || b > 1000 || a < 0 || b < 0 ? 0 : a + b)

const part = (xs: i32[], start: i32, end: i32): i32 => {
  if (start >= 0 && start <= end && end <= xs.length) {
    return sum(xs, start, end)
  }
  return 0
}

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4]
  const n = toI32(xs.length)
  console.log(`${sum(xs, 0, 2)}`)
  console.log(`${sum(xs, 0, toI32(xs.length))}`)
  console.log(`${part(xs, 1, 3)}`)
  const s = new Span(0)
  const at = n - 1
  if (at >= 0) {
    console.log(`${s.width(at)}`)
  }
  console.log(done())
  return 0
}
