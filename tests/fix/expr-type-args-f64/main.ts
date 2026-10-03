// NL2303 under `--number-mode f64`: an integer literal is `number`, which is
// `f64` here, so `identity(7)` infers the `f64` written and the fix deletes
// the type argument, as it does `number` written there.
const identity = <T>(x: T): T => x
export const main = (): i32 => {
  const seven = identity<f64>(7)
  const half = seven / 2
  console.log(`${half}`)
  return 0
}
