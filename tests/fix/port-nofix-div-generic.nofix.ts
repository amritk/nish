// A generic body is shared by every instantiation, and `toI32` around its
// quotient would change the IR of an `f64` one: no review edit.
const ratio = <T>(a: T, b: T): T => a / b

export const main = (): i32 => {
  const x: i32 = 7
  const y: i32 = 2
  console.log(`${ratio(x, y)} ${ratio(toF64(7), toF64(2))}`)
  return 0
}
