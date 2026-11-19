// WP41: `mulHigh` takes two `u64`s and nothing narrower or signed. A `u32`
// would read as a high half that is always zero; an `i64` has no 128-bit
// unsigned product to take the top of. Each operand is refused with NL2805.
export const main = (): i32 => {
  const small: u32 = 7
  const signed: i64 = toI64(-3)
  const wide: u64 = toU64(9)
  console.log(`${mulHigh(small, wide)}`)
  console.log(`${mulHigh(wide, signed)}`)
  return 0
}
