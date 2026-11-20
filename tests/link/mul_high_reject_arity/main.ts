// WP41: `mulHigh` takes exactly two operands; one is refused.
export const main = (): i32 => {
  const wide: u64 = toU64(9)
  console.log(`${mulHigh(wide)}`)
  return 0
}
