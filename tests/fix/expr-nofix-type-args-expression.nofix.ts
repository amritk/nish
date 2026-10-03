// NL2303: the argument is an expression, whose type the fix does not check, so
// it cannot prove `T` is inferred as the `i64` written; no fix.
const identity = <T>(x: T): T => x
export const test = (): number => {
  const n: i32 = 1
  const x = identity<i64>(n + 1)
  return 0
}
