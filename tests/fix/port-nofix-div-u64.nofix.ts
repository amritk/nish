// `u64` has no review edit for the reason `i64` has none: under Node it is a
// double, which `toU64` would round.
const f = (a: u64, b: u64): u64 => a / b

export const main = (): i32 => {
  console.log(`${f(toU64(7), toU64(2))}`)
  return 0
}
