// WP41: `mulHigh` takes no signed operand. An `i64` has no 128-bit unsigned
// product to take the top of, so the second operand is refused with NL2823.
export const main = (): i32 => {
  const signed: i64 = toI64(-3)
  const wide: u64 = toU64(9)
  console.log(`${mulHigh(wide, signed)}`)
  return 0
}
