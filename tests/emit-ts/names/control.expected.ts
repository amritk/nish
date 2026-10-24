// The control row's helpers where the module binds their names itself: a
// local `Err` and a function `caught` would shadow or clash with the
// runtime's, so the hoisted `return Err(…)` and the `try`'s `caught` call
// them by an alias, and the program's own keep theirs.
import { Result, Ok, Err as __nish_Err, checkedMul, checkedAdd, caught as __nish_caught } from "nish/runtime"
import type { i32 } from "nish/runtime"
const parse = (s: string): Result<i32, string> => (s === "one" ? Ok(1) : __nish_Err(`cannot parse ${s}`))

const caught = (n: i32): i32 => checkedMul(n, 2)

class Table {
  base: i32
  constructor(base: i32) {
    this.base = base
  }
  get(k: i32): i32 {
    return checkedAdd(this.base, k)
  }
}

// Hoisted: `return Err(t.error)` goes before the statement.
const hoisted = (s: string): Result<i32, string> => {
  const __t0 = parse(s);
  if (__t0.isErr()) return __nish_Err(__t0.error);
  const Err = caught(__t0.value)
  return Ok(Err)
}

// Under `?.`: the body is wrapped, and its `catch` hands the throw to `caught`.
const wrapped = (t: Table | null, s: string): Result<i32, string> => { try {
  const v = t?.get(parse(s).orReturn()) ?? 0
  return Ok(caught(v))
} catch (__t1) { return __nish_caught(__t1) } }

const show = (r: Result<i32, string>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`)

export const main = (): number => {
  console.log(show(hoisted("one")))
  console.log(show(hoisted("six")))
  console.log(show(wrapped(new Table(10), "one")))
  console.log(show(wrapped(new Table(10), "six")))
  return 0
}
