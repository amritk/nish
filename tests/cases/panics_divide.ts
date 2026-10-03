// Panic sites: integer `/` and `%` check for a zero divisor (and `MIN / -1`
// when signed) and panic, the compound forms too; a float division does not.
const quotient = (a: i32, b: i32): i32 => a / b

const remainder = (a: i32, b: i32): i32 => {
  let r: i32 = a
  r %= b
  return r
}

const ratio = (a: f64, b: f64): f64 => a / b

export const main = (): number => {
  console.log(quotient(17, 5))
  console.log(remainder(17, 5))
  console.log(ratio(1.0, 4.0))
  return 0
}
