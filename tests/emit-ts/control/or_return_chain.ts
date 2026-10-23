// `orReturn` where its statement can take a prelude: each call becomes a
// temporary, an `isErr` test and a return of the `Err`, hoisted before the
// statement in the order the calls run. A local spelled like a temporary,
// `__t0`, is skipped by the numbering, and a method of the program's own
// named `orReturn` is a call like any other, which `base` needs no wrap for.
const parse = (s: string): Result<i32, string> => {
  if (s === "one") {
    return Ok(1)
  }
  if (s === "two") {
    return Ok(2)
  }
  return Err(`cannot parse ${s}`)
}

const check = (n: i32): Result<void, string> => (n < 10 ? Ok() : Err(`${n} is too big`))

class Fallback {
  orReturn(): i32 {
    return 1
  }
}

const base = (): i32 => new Fallback().orReturn() - 1

const sum = (a: string, b: string): Result<i32, string> => {
  const __t0: i32 = base()
  const x = parse(a).orReturn() + __t0
  const y = parse(b).orReturn(), z = parse(a).orReturn()
  check(x + y + z).orReturn()
  if (parse(b).orReturn() > 1) {
    return Ok(x + y + z)
  }
  return Ok(parse(a).orReturn() + parse(b).orReturn())
}

const loop = (words: string[]): Result<i32, string> => {
  let total: i32 = 0
  for (const w of words) {
    total = total + parse(w).orReturn()
  }
  return Ok(total)
}

const show = (r: Result<i32, string>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`)

export const main = (): number => {
  console.log(show(sum("one", "two")))
  console.log(show(sum("two", "one")))
  console.log(show(sum("one", "six")))
  console.log(show(loop(["one", "two", "two"])))
  console.log(show(loop(["one", "ten"])))
  return 0
}
