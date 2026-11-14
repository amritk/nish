// A pattern `for...of` whose body has no braces. The parser wraps that body
// in a block the source never wrote, so nothing may be hoisted into it: a
// hoisted `orReturn` would land outside the loop. Each function's body is
// wrapped in a `try` that `caught` answers instead, as its hand-written twin
// with a named loop variable is.
interface P {
  a: i32
  b: i32
}

const half = (n: i32): Result<i32, string> => (n % 2 === 0 ? Ok(n / 2) : Err(`${n} is odd`))

const bare = (ps: P[]): Result<i32, string> => {
  let t = 0
  for (const { a } of ps) t += half(a).orReturn()
  return Ok(t)
}

const guarded = (ps: P[]): Result<i32, string> => {
  let t = 0
  for (const { a, b } of ps) if (b > 0) t += half(a).orReturn()
  return Ok(t)
}

const looping = (ps: P[]): Result<i32, string> => {
  let t = 0
  for (const [x, y] of [[ps.length, 2]]) while (t < x * y) t += half(2).orReturn()
  return Ok(t)
}

const skipping = (ps: P[]): Result<i32, string> => {
  let t = 0
  for (const { a, b } of ps) {
    if (b > 0) continue
    t += half(a).orReturn()
  }
  for (const { b } of ps) if (b > 0) continue; else t += b
  return Ok(t)
}

const nested = (ps: P[]): Result<i32, string> => {
  let t = 0
  for (const { a } of ps) for (const { b } of ps) t += half(a + b).orReturn()
  return Ok(t)
}

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
