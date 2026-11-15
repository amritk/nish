// A pattern `for...of` whose body has no braces. The parser wraps that body
// in a block the source never wrote, so nothing may be hoisted into it: a
// hoisted `orReturn` would land outside the loop. Each function's body is
// wrapped in a `try` that `caught` answers instead, as its hand-written twin
// with a named loop variable is.
import { Result, irem, Ok, idiv, Err, checkedAdd, caught, checkedMul, idx } from "nish/runtime"
import type { i32 } from "nish/runtime"
interface P {
  a: i32
  b: i32
}

const half = (n: i32): Result<i32, string> => (irem(n, 2) === 0 ? Ok(idiv(n, 2)) : Err(`${n} is odd`))

const bare = (ps: P[]): Result<i32, string> => { try {
  let t = 0
  for (const { a } of ps) t = checkedAdd(t, half(a).orReturn())
  return Ok(t)
} catch (__t0) { return caught(__t0) } }

const guarded = (ps: P[]): Result<i32, string> => { try {
  let t = 0
  for (const { a, b } of ps) if (b > 0) t = checkedAdd(t, half(a).orReturn())
  return Ok(t)
} catch (__t1) { return caught(__t1) } }

const looping = (ps: P[]): Result<i32, string> => { try {
  let t = 0
  for (const [x, y] of (function* (__t3) { for (const __t2 of __t3) yield (idx(__t2, 0), idx(__t2, 1), __t2) })([[ps.length, 2]])) while (t < checkedMul(x, y)) t = checkedAdd(t, half(2).orReturn())
  return Ok(t)
} catch (__t4) { return caught(__t4) } }

const skipping = (ps: P[]): Result<i32, string> => {
  let t = 0
  for (const { a, b } of ps) {
    if (b > 0) continue
    const __t5 = half(a);
    if (__t5.isErr()) return Err(__t5.error);
    t = checkedAdd(t, __t5.value)
  }
  for (const { b } of ps) if (b > 0) continue; else t = checkedAdd(t, b)
  return Ok(t)
}

const nested = (ps: P[]): Result<i32, string> => { try {
  let t = 0
  for (const { a } of ps) for (const { b } of ps) t = checkedAdd(t, half(checkedAdd(a, b)).orReturn())
  return Ok(t)
} catch (__t6) { return caught(__t6) } }

const show = (r: Result<i32, string>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`)

export const main = (): number => {
  const even: P[] = [{ a: 2, b: 0 }, { a: 4, b: 2 }]
  const odd: P[] = [{ a: 2, b: 1 }, { a: 3, b: 0 }]
  console.log(show(bare(even)))
  console.log(show(bare(odd)))
  console.log(show(guarded(even)))
  console.log(show(guarded(odd)))
  console.log(show(looping(even)))
  console.log(show(skipping(even)))
  console.log(show(skipping(odd)))
  console.log(show(nested(even)))
  console.log(show(nested(odd)))
  return 0
}
