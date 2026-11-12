// NL8006's review edit wraps the quotient in `toI32`, which is the identity
// on an `i32`: the call's own parentheses keep it whole wherever it stands.
const scaled = (a: i32, b: i32, c: i32): i32 => toI32(a / b) * c
const negated = (a: i32, b: i32): i32 => -(toI32(a / b))
const next = (x: i32): i32 => x + 1

export const main = (): i32 => {
  console.log(`${scaled(7, 2, 3)} ${negated(7, 2)} ${next(toI32(-7 / 2))}`)
  return 0
}
