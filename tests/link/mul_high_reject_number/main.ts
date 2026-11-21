// WP41: a `number` is not a `u64`, so `mulHigh` refuses it with NL2822 rather
// than converting it; the fix the message names is `toU64`.
export const main = (): i32 => {
  const n: number = 2
  const wide: u64 = toU64(9)
  console.log(`${mulHigh(wide, n)}`)
  return 0
}
