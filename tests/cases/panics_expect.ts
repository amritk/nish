// Panic sites: `r.expect(message)` panics on an `Err`; `unwrapOr` and
// `orReturn` do not, and are not sites.
const parse = (s: string): Result<i32, string> => {
  if (s.length === 0) {
    return Err("empty")
  }
  return Ok(toI32(s.length))
}

const strict = (s: string): i32 => parse(s).expect("a non-empty string")

const lenient = (s: string): i32 => parse(s).unwrapOr(0)

export const main = (): number => {
  console.log(strict("abc"))
  console.log(lenient(""))
  return 0
}
