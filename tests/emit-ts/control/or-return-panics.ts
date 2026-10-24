// An `orReturn` after an operand that may panic: an integer `/` or `%` whose
// divisor is not proven nonzero, or checked arithmetic not proven to fit. With
// `b` = 0, Nish stops at `a / b` before `f` runs; a hoisted `f` would print
// first. A fixture has to exit 0, so the inputs here do not panic and the
// `.expected.ts` golden pins that none of these statements is hoisted. Each is
// called over operands the range analysis cannot close (a divisor of either
// sign, factors up to 100000 each), so no proof takes its check away. A float
// division cannot panic, so `ratio` still hoists.
const f = (s: string): Result<i32, string> => {
  console.log(`f ${s}`)
  return s.length > 0 ? Ok(s.length) : Err("empty")
}

const half = (s: string): Result<f64, string> => {
  console.log(`half ${s}`)
  return s.length > 0 ? Ok(toF64(1) / 2.0) : Err("empty")
}

const divide = (a: i32, b: i32, s: string): Result<i32, string> => {
  const v = a / b + f(s).orReturn()
  return Ok(v)
}

const rest = (a: i32, b: i32, s: string): Result<i32, string> => {
  const v = a % b + f(s).orReturn()
  return Ok(v)
}

const scale = (a: i32, b: i32, s: string): Result<i32, string> => {
  const v = a * b + f(s).orReturn()
  return Ok(v)
}

const ratio = (x: f64, y: f64, s: string): Result<f64, string> => {
  const v = x / y + half(s).orReturn()
  return Ok(v)
}

const show = (r: Result<i32, string>): string => (r.isOk() ? `ok ${r.value}` : `err ${r.error}`)

export const main = (): number => {
  console.log(show(divide(8, 2, "ab")))
  console.log(show(divide(8, -2, "")))
  console.log(show(rest(7, 2, "abc")))
  console.log(show(rest(7, -2, "")))
  console.log(show(scale(100000, 1, "a")))
  console.log(show(scale(1, 100000, "")))
  const r = ratio(1.0, 4.0, "ab")
  console.log(r.isOk() ? `ok ${r.value}` : `err ${r.error}`)
  return 0
}
