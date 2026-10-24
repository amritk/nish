// An i64 or u64 index of a string method goes through `Number` as an
// argument of its own, so the strings row still turns the call into its byte
// offset helper: under Node, `"héllo".slice(0, 3)` would count UTF-16 units.
import { slice, offsets, substring, indexOf, charCodeAt } from "nish/runtime"
import type { i32, i64, u64 } from "nish/runtime"
export const main = (): i32 => {
  const s = "héllo wörld"
  const three: i64 = 3n
  const one: u64 = 1n
  console.log(slice(s, 0, Number(three)))
  console.log(substring(s, ...offsets(0, [one, BigInt.asIntN(64, three + 1n)])))
  console.log(`${indexOf(s, "l", Number(three))} ${charCodeAt(s, ...offsets(0, [BigInt.asIntN(64, three - 1n)]))}`)
  console.log(slice(s, ...offsets(0, [BigInt.asIntN(64, three * 2n)])))
  return 0
}
