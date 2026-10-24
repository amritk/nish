// `Math.sign` on an i64 or u64 goes through the core's `signI64`, where Math
// refuses a BigInt; `min`, `max` and `round` on an f64 stay Math's own, -0
// and the half-way round included.
import { signI64 } from "nish/runtime"
import type { i64, u64, f64 } from "nish/runtime"
export const main = (): number => {
  const a: i64 = -9007199254740993n
  const big: u64 = 4294967296n
  const b: u64 = BigInt.asUintN(64, BigInt.asUintN(64, big * big) - 1n)
  const z: i64 = 0n
  const one: f64 = 1.0
  const n: f64 = -0.0
  const p: f64 = 0.0
  const h: f64 = 2.5
  const m: f64 = -1.5
  const q: f64 = -0.4
  console.log(`${signI64(a)} ${signI64(b)} ${signI64(z)}`)
  console.log(`${one / Math.min(p, n)} ${one / Math.max(n, p)} ${Math.min(h, m)} ${Math.max(h, m)}`)
  console.log(`${Math.round(h)} ${Math.round(-h)} ${Math.round(q)} ${one / Math.round(q)}`)
  return 0
}
