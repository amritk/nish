// `orReturn` inside another expression. One whose receiver holds another
// hoists the inner first; one inside a rewritten child (`Arena.used()`, which
// becomes the runtime's `arenaUsed()`) composes with it. Where a call runs
// before it, after `&&`, or in a concise arrow body, nothing may hoist, and
// the function's body is wrapped in a `try` that `caught` answers instead.
import { Result, irem, Ok, idiv, Err, caught, arenaUsed, checkedAdd } from "nish/runtime"
import type { i32 } from "nish/runtime"
const half = (n: i32): Result<i32, string> => (irem(n, 2) === 0 ? Ok(idiv(n, 2)) : Err(`${n} is odd`))

const note = (noted: string[], s: string): i32 => {
  noted.push(s)
  return 0
}

const quarter = (n: i32): Result<i32, string> => { try { return Ok(half(half(n).orReturn()).orReturn()) } catch (__t0) { return caught(__t0) } }

const nested = (n: i32): Result<string, string> => {
  const __t1 = half(n);
  if (__t1.isErr()) return Err(__t1.error);
  const __t2 = half(__t1.value);
  if (__t2.isErr()) return Err(__t2.error);
  const __t3 = half(checkedAdd(n, (arenaUsed() >= 0n ? 0 : 1)));
  if (__t3.isErr()) return Err(__t3.error);
  const s = `${__t2.value} ${__t3.value}`
  return Ok(s)
}

const late = (noted: string[], n: i32): Result<i32, string> => { try {
  const v = ((note(noted, "late") + half(n).orReturn()) | 0)
  return Ok(v)
} catch (__t4) { return caught(__t4) } }

const guarded = (n: i32): Result<boolean, string> => { try {
  const b = n > 0 && half(n).orReturn() > 1
  return Ok(b)
} catch (__t5) { return caught(__t5) } }

const show = (r: Result<i32, string>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`)

export const main = (): number => {
  console.log(show(quarter(12)))
  console.log(show(quarter(6)))
  const a = nested(8)
  console.log(a.isOk() ? a.value : a.error)
  const b = nested(6)
  console.log(b.isOk() ? b.value : b.error)
  const noted: string[] = []
  console.log(show(late(noted, 4)))
  console.log(show(late(noted, 5)))
  console.log(noted.length)
  const c = guarded(3)
  console.log(c.isOk() ? `${c.value}` : c.error)
  const d = guarded(-3)
  console.log(d.isOk() ? `${d.value}` : d.error)
  return 0
}
