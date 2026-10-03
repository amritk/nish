// NL2303: `identity(7)` infers `i32`, not the `f64` written, so deleting the
// type argument would change the call; there is no fix.
const identity = <T>(x: T): T => x
export const test = (): number => {
  const x = identity<f64>(7)
  console.log(`${x}`)
  return 0
}
