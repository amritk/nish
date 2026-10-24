// An i64 or u64 offset of an array's `fill` goes through `Number`,
// which JavaScript's methods take where they refuse a `bigint`. Past 2^53 it
// rounds, but to a value still past the end, where the clamp lands anyway.
// An i64 element type keeps its fill value a `bigint`.
export const main = (): i32 => {
  const top: u64 = toU64(1) << 63
  const a: u8[] = [1, 2, 3, 4, 5]
  a.fill(9, top)
  a.fill(8, toU64(1), toU64(3))
  const at: i64 = 3
  a.fill(6, at)
  console.log(`${a[0]} ${a[1]} ${a[2]} ${a[3]} ${a[4]}`)
  const w: i64[] = [0, 0, 0]
  const big: i64 = 9007199254740993
  w.fill(big, at - 2)
  console.log(`${w[0]} ${w[1]} ${w[2]}`)
  return 0
}
