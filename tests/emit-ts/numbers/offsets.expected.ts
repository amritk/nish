// An i64 or u64 offset of an array's `fill` goes through `Number`,
// which JavaScript's methods take where they refuse a `bigint`. Past 2^53 it
// rounds, but to a value still past the end, where the clamp lands anyway.
// An i64 element type keeps its fill value a `bigint`.
import { convert, shlU64, offsets } from "nish/runtime"
import type { i32, u64, u8, i64 } from "nish/runtime"
export const main = (): i32 => {
  const top: u64 = shlU64(convert(1, "i32", "u64"), 63n)
  const a: u8[] = [1, 2, 3, 4, 5]
  a.fill(9, Number(top))
  a.fill(...offsets(1, [8, convert(1, "i32", "u64"), convert(3, "i32", "u64")]))
  const at: i64 = 3n
  a.fill(6, Number(at))
  console.log(`${a[0]} ${a[1]} ${a[2]} ${a[3]} ${a[4]}`)
  const w: i64[] = [0n, 0n, 0n]
  const big: i64 = 9007199254740993n
  w.fill(...offsets(1, [big, BigInt.asIntN(64, at - 2n)]))
  console.log(`${w[0]} ${w[1]} ${w[2]}`)
  return 0
}
