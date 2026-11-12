// `toI64` is no identity under Node, where an `i64` is a double that the
// conversion would round, so a 64-bit quotient gets no review edit.
const f = (a: i64, b: i64): i64 => a / b

export const main = (): i32 => {
  console.log(`${f(toI64(7), toI64(2))}`)
  return 0
}
