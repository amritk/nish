// WP41: `mulHigh` takes two `u64`s and nothing narrower. A `u32` would read
// as a high half that is always zero, so the operand is refused with NL2823.
export const main = (): i32 => {
  const small: u32 = 7
  const wide: u64 = toU64(9)
  console.log(`${mulHigh(small, wide)}`)
  return 0
}
