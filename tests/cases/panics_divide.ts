// Panic sites: integer `/` and `%` check for a zero divisor (and `MIN / -1`
// when signed) and panic, the compound forms too; a float division does not.
// A divisor proven to be neither 0 nor -1 — a constant, an unsigned divisor
// behind `d !== 0`, a signed one behind `d !== 0 && d !== -1` — has no check,
// and its site is proven.
const quotient = (a: i32, b: i32): i32 => a / b

const remainder = (a: i32, b: i32): i32 => {
  let r: i32 = a
  r %= b
  return r
}

const ratio = (a: f64, b: f64): f64 => a / b

const halves = (a: i32): i32 => a / 2 + a % -3

const share = (a: u32, d: u32): u32 => {
  if (d !== 0) {
    return a / d
  }
  return 0
}

const guarded = (a: i32, d: i32): i32 => {
  if (d !== 0 && d !== -1) {
    return a / d
  }
  return 0
}

export const main = (): number => {
  console.log(quotient(17, 5))
  console.log(remainder(17, 5))
  console.log(ratio(1.0, 4.0))
  console.log(halves(17))
  console.log(toI32(share(17, 4)))
  console.log(guarded(17, -1))
  return 0
}
