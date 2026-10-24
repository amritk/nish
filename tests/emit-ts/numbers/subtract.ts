// A u32 subtraction below zero wraps natively, and an i32 one that overflows
// panics: under Node the first is `>>> 0` and the second `checkedSub`, which
// writes the same message to stderr and exits 1 with nothing printed after it.
const wrap = (a: u32, b: u32): u32 => a - b
const sub = (a: i32, b: i32): i32 => a - b

export const main = (): i32 => {
  console.log(wrap(1, 2))
  console.log(sub(-2147483647, 1))
  console.log(sub(-2147483648, 1))
  console.log("unreachable")
  return 0
}
