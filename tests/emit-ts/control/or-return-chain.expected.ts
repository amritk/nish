// `orReturn` where its statement can take a prelude: each call becomes a
// temporary, an `isErr` test and a return of the `Err`, hoisted before the
// statement in the order the calls run. A local spelled like a temporary,
// `__t0`, is skipped by the numbering, and a method of the program's own
// named `orReturn` is a call like any other, which `base` needs no wrap for.
import { Result, Ok, Err, checkedSub, checkedAdd } from "nish/runtime"
import type { i32 } from "nish/runtime"
const parse = (s: string): Result<i32, string> => {
  if (s === "one") {
    return Ok(1)
  }
  if (s === "two") {
    return Ok(2)
  }
  return Err(`cannot parse ${s}`)
}

const check = (n: i32): Result<void, string> => (n < 6 ? Ok() : Err(`${n} is too big`))

class Fallback {
  orReturn(): i32 {
    return 1
  }
}

const base = (): i32 => checkedSub(new Fallback().orReturn(), 1)

const sum = (a: string, b: string, c: string, d: string): Result<i32, string> => {
  const __t0: i32 = base()
  const __t1 = parse(a);
  if (__t1.isErr()) return Err(__t1.error);
  const x = checkedAdd(__t1.value, __t0)
  const __t2 = parse(b);
  if (__t2.isErr()) return Err(__t2.error);
  const y = __t2.value
  const __t3 = parse(c);
  if (__t3.isErr()) return Err(__t3.error);
  const z = __t3.value
  const __t4 = check(checkedAdd(checkedAdd(x, y), z));
  if (__t4.isErr()) return Err(__t4.error);
  __t4.value
  const __t5 = parse(d);
  if (__t5.isErr()) return Err(__t5.error);
  if (__t5.value > 1) {
    return Ok(checkedAdd(checkedAdd(x, y), z))
  }
  return Ok(checkedSub(x, y))
}

const both = (a: string, b: string): Result<i32, string> => {
  const __t6 = parse(a);
  if (__t6.isErr()) return Err(__t6.error);
  const __t7 = parse(b);
  if (__t7.isErr()) return Err(__t7.error);
  return Ok(checkedAdd(__t6.value, __t7.value))
}

const loop = (words: string[]): Result<i32, string> => {
  let total: i32 = 0
  for (const w of words) {
    const __t8 = parse(w);
    if (__t8.isErr()) return Err(__t8.error);
    total = checkedAdd(total, __t8.value)
  }
  return Ok(total)
}

const show = (r: Result<i32, string>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`)

export const main = (): number => {
  console.log(show(sum("one", "two", "one", "two")))
  console.log(show(sum("six", "two", "one", "two")))
  console.log(show(sum("one", "seven", "one", "two")))
  console.log(show(sum("one", "two", "nine", "two")))
  console.log(show(sum("two", "two", "two", "two")))
  console.log(show(sum("one", "two", "one", "eight")))
  console.log(show(sum("one", "two", "one", "one")))
  console.log(show(both("one", "two")))
  console.log(show(both("five", "two")))
  console.log(show(both("one", "ten")))
  console.log(show(both("five", "ten")))
  console.log(show(loop(["one", "two", "two"])))
  console.log(show(loop(["one", "ten"])))
  return 0
}
