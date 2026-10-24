// A negated integer literal that spells zero, in any base, is the integer
// zero natively, never JavaScript's -0: the sign would show in `1 / x`.
import { toF64 } from "nish/runtime"
import type { f64, i32, i64 } from "nish/runtime"
export const main = (): number => {
  const one: f64 = 1
  const d: i32 = 0
  const h: i32 = 0
  const b: i32 = 0
  const o: i32 = 0
  const w: i64 = 0n
  console.log(`${one / toF64(d)} ${one / toF64(h)} ${one / toF64(b)} ${one / toF64(o)} ${w}`)
  return 0
}
