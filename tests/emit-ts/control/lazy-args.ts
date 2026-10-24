// The argument of `expect` and `unwrapOr` runs on the `Err` path only (#182),
// so nothing in it may be hoisted ahead of the call: not an `orReturn`, whose
// early return would leave `pick` before `r` is looked at, not a call that
// prints, and not an index that would panic. Each `r` here is `Ok` but the
// last, so `fallback` prints once and the out-of-range index never runs.
const parse = (n: i32): Result<i32, string> => (n < 0 ? Err("negative") : Ok(n))

const fallback = (s: string): Result<i32, string> => {
  console.log(`fallback ${s}`)
  return s.length > 0 ? Ok(s.length) : Err("empty")
}

const pick = (n: i32, s: string): Result<i32, string> => {
  const v = parse(n).unwrapOr(fallback(s).orReturn())
  return Ok(v)
}

const note = (): string => {
  console.log("note")
  return "no value"
}

const show = (q: Result<i32, string>): string => (q.isOk() ? `ok ${q.value}` : `err ${q.error}`)

export const main = (): number => {
  const xs: i32[] = [1, 2, 3]
  const r = parse(4)
  console.log(`${r.expect(note())}`)
  console.log(`${r.expect(`at ${xs[5]}`)}`)
  console.log(`${r.unwrapOr(xs[9])}`)
  console.log(show(pick(2, "")))
  console.log(show(pick(-1, "abc")))
  console.log(show(pick(-1, "")))
  return 0
}
