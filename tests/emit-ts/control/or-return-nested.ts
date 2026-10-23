// `orReturn` inside another expression. One whose receiver holds another
// hoists the inner first; one inside a rewritten child (`Arena.used()`, which
// becomes the runtime's `arenaUsed()`) composes with it. Where a call runs
// before it, after `&&`, or in a concise arrow body, nothing may hoist, and
// the function's body is wrapped in a `try` that `caught` answers instead.
const half = (n: i32): Result<i32, string> => (n % 2 === 0 ? Ok(n / 2) : Err(`${n} is odd`))

const note = (noted: string[], s: string): i32 => {
  noted.push(s)
  return 0
}

const quarter = (n: i32): Result<i32, string> => Ok(half(half(n).orReturn()).orReturn())

const nested = (n: i32): Result<string, string> => {
  const s = `${half(half(n).orReturn()).orReturn()} ${half(n + (Arena.used() >= 0 ? 0 : 1)).orReturn()}`
  return Ok(s)
}

const late = (noted: string[], n: i32): Result<i32, string> => {
  const v = note(noted, "late") + half(n).orReturn()
  return Ok(v)
}

const guarded = (n: i32): Result<boolean, string> => {
  const b = n > 0 && half(n).orReturn() > 1
  return Ok(b)
}

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
