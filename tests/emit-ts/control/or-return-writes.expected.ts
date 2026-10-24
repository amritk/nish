// An `orReturn` whose call writes a local the statement read before it: the
// read runs first in Nish, so hoisting the call ahead of it would let the read
// see the write. The statement falls back to the throw path. A call that
// writes nothing still hoists past a local read (`or-return-reads`).
import { Result, Ok, Err, checkedAdd, checkedMul, caught } from "nish/runtime"
import type { i32 } from "nish/runtime"
const g = (n: i32): Result<i32, string> => (n < 10 ? Ok(n) : Err(`${n} is too big`))

const bump = (start: i32): Result<i32, string> => { try {
  let n = start
  const v = checkedAdd(n, g(n++).orReturn())
  return Ok(checkedAdd(checkedMul(v, 100), n))
} catch (__t0) { return caught(__t0) } }

const set = (start: i32): Result<i32, string> => { try {
  let m = start
  const v = checkedAdd(m, g((m = ((m + 4) | 0))).orReturn())
  return Ok(checkedAdd(checkedMul(v, 100), m))
} catch (__t1) { return caught(__t1) } }

const show = (r: Result<i32, string>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`)

export const main = (): number => {
  console.log(show(bump(1)))
  console.log(show(bump(20)))
  console.log(show(set(1)))
  console.log(show(set(7)))
  return 0
}
